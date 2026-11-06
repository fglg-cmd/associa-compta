import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { serverEnv } from "./env";
import { extractFields } from "./ocr-extract";

export interface OcrResult {
  status: "done" | "skipped" | "failed";
  text: string;
  engine: "pdf-text" | "google-vision" | "tesseract" | "docx" | "xlsx" | "none";
  fields: ReturnType<typeof extractFields>;
  message?: string;
}

const empty = { amount: null, date: null, vendor: null };

async function visionAnnotate(bytes: Buffer, mime: string): Promise<string> {
  const key = serverEnv.googleVisionApiKey!;
  const content = bytes.toString("base64");
  if (mime === "application/pdf") {
    const res = await fetch(`https://vision.googleapis.com/v1/files:annotate?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ inputConfig: { content, mimeType: "application/pdf" }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], pages: [1, 2, 3, 4, 5] }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`Google Vision : ${res.status}`);
    const json = (await res.json()) as { responses?: { responses?: { fullTextAnnotation?: { text?: string } }[] }[] };
    return (json.responses?.[0]?.responses ?? []).map((r) => r.fullTextAnnotation?.text ?? "").join("\n");
  }
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["fr", "en"] } }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google Vision : ${res.status}`);
  const json = (await res.json()) as { responses?: { fullTextAnnotation?: { text?: string } }[] };
  return json.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

/*
 * Tesseract (OCR local, sans clé) :
 * - dictionnaire français embarqué dans le déploiement (ocr-data/, 700 Ko, modèle
 *   « best_int » du paquet @tesseract.js-data/fra, licence Apache-2.0) : plus de
 *   téléchargement à chaque lecture ;
 * - moteur gardé en mémoire entre deux lectures sur la même instance ;
 * - image réduite à 2 000 px avant lecture si elle est plus grande (photo de téléphone
 *   12 Mpx) : la lecture est environ 5 fois plus rapide, sans perte de précision utile.
 */
const OCR_DATA_DIR = path.join(process.cwd(), "ocr-data");
const MAX_SIDE = 2000;

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let workerPromise: Promise<TesseractWorker> | null = null;

function getWorker() {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const local = existsSync(path.join(OCR_DATA_DIR, "fra.traineddata.gz"));
    return createWorker("fra", 1, local ? { langPath: OCR_DATA_DIR, cacheMethod: "none" } : { cachePath: "/tmp" });
  })().catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

/** Réduit une image trop grande (et la passe en niveaux de gris) avant la lecture. */
async function prepareImage(bytes: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(bytes, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_SIDE) return bytes;
    return await img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).grayscale().jpeg({ quality: 85 }).toBuffer();
  } catch {
    return bytes; // sharp indisponible : lecture de l'image d'origine
  }
}

async function tesseract(bytes: Buffer): Promise<string> {
  const input = await prepareImage(bytes);
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(input);
    return data.text;
  } catch (e) {
    workerPromise = null; // moteur en erreur : recréé à la prochaine lecture
    throw e;
  }
}

/**
 * Extraction de texte par type de fichier :
 * PDF natif → couche texte ; PDF scanné / image → Google Vision (si clé) ou
 * Tesseract (images) ; Word → mammoth ; Excel → exceljs.
 */
export async function runOcr(bytes: Buffer, mime: string): Promise<OcrResult> {
  try {
    let text = "";
    let engine: OcrResult["engine"] = "none";

    if (mime === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
      engine = "pdf-text";
      if (text.replace(/\s/g, "").length < 30) {
        if (!serverEnv.googleVisionApiKey) {
          return { status: "skipped", text: "", engine: "none", fields: empty, message: "PDF scanné : configurez Google Vision pour le lire automatiquement." };
        }
        text = await visionAnnotate(bytes, mime);
        engine = "google-vision";
      }
    } else if (mime.startsWith("image/")) {
      if (serverEnv.googleVisionApiKey) {
        text = await visionAnnotate(bytes, mime);
        engine = "google-vision";
      } else if (/image\/(png|jpe?g|webp|bmp|gif)/.test(mime)) {
        text = await tesseract(bytes);
        engine = "tesseract";
      } else {
        return { status: "skipped", text: "", engine: "none", fields: empty, message: "Format d'image non pris en charge par l'OCR local." };
      }
    } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
      engine = "docx";
    } else if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bytes as unknown as ArrayBuffer);
      const parts: string[] = [];
      wb.eachSheet((ws) => ws.eachRow((row) => parts.push((row.values as unknown[]).slice(1).map((v) => (v == null ? "" : typeof v === "object" && "result" in (v as object) ? String((v as { result: unknown }).result) : String(v))).join(" "))));
      text = parts.join("\n");
      engine = "xlsx";
    } else {
      return { status: "skipped", text: "", engine: "none", fields: empty, message: "Ce type de fichier n'est pas analysé." };
    }

    text = text.replace(/\u0000/g, "").slice(0, 100_000);
    return { status: "done", text, engine, fields: extractFields(text) };
  } catch (e) {
    console.error("[ocr]", e);
    return { status: "failed", text: "", engine: "none", fields: empty, message: (e as Error).message };
  }
}
