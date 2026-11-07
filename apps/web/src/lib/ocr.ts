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
  /** Confiance moyenne de Tesseract (0-100) ; null pour les autres moteurs. */
  confidence?: number | null;
  message?: string;
}

const empty = { amount: null, date: null, vendor: null, reference: null };

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

/**
 * Prépare une image pour la lecture : redressement EXIF, fond blanc (pages PDF transparentes),
 * largeur ramenée entre 2 000 et 2 500 px (les petites images, comme une facture enregistrée
 * depuis internet, sont agrandies : Tesseract lit très mal les petits caractères ; les grandes
 * photos sont réduites pour aller vite), niveaux de gris, contraste et netteté.
 */
async function prepareImage(bytes: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    const w = meta.autoOrient?.width ?? meta.width ?? MAX_SIDE;
    const h = meta.autoOrient?.height ?? meta.height ?? MAX_SIDE;
    let target = w > 2500 ? 2500 : w < MAX_SIDE ? Math.min(w * 4, MAX_SIDE) : w;
    target = Math.max(1, Math.min(target, Math.round((w * 6000) / h))); // tickets très longs
    return await sharp(bytes, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: target, kernel: "lanczos3" })
      .grayscale()
      .normalize()
      .sharpen()
      .png({ compressionLevel: 1 })
      .toBuffer();
  } catch {
    return bytes; // sharp indisponible : lecture de l'image d'origine
  }
}

const OCR_TIMEOUT_MS = 40_000;

/** Échoue proprement au lieu de laisser la lecture « en cours » indéfiniment. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("La lecture automatique a pris trop de temps. Réessayez avec « Relire ».")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function tesseract(bytes: Buffer): Promise<{ text: string; confidence: number }> {
  const input = await prepareImage(bytes);
  try {
    return await withTimeout(
      (async () => {
        const worker = await getWorker();
        const { data } = await worker.recognize(input);
        return { text: data.text, confidence: data.confidence };
      })(),
      OCR_TIMEOUT_MS,
    );
  } catch (e) {
    // Moteur en erreur ou bloqué : on l'abandonne, il sera recréé à la prochaine lecture.
    const stale = workerPromise;
    workerPromise = null;
    void stale?.then((w) => w.terminate()).catch(() => {});
    throw e;
  }
}

/**
 * Extraction de texte par type de fichier :
 * PDF natif → couche texte ; PDF scanné / image → Google Vision (si clé) ou
 * Tesseract (images) ; Word → mammoth ; Excel → exceljs.
 */
export async function runOcr(bytes: Buffer, mime: string, opts: { exclude?: string[] } = {}): Promise<OcrResult> {
  try {
    let text = "";
    let engine: OcrResult["engine"] = "none";
    let confidence: number | null = null;

    if (mime === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
      engine = "pdf-text";
      if (text.replace(/\s/g, "").length < 30) {
        if (serverEnv.googleVisionApiKey) {
          text = await visionAnnotate(bytes, mime);
          engine = "google-vision";
        } else {
          // PDF scanné (une image par page) : les 2 premières pages sont converties en image
          // puis lues par Tesseract, comme une photo. Gratuit, sans clé.
          const { renderPageAsImage } = await import("unpdf");
          const parts: string[] = [];
          const confidences: number[] = [];
          for (let page = 1; page <= Math.min(2, pdf.numPages); page++) {
            // Rendu à environ 2 500 px de large (≈ 300 dpi pour une page A4).
            const width = (await pdf.getPage(page)).getViewport({ scale: 1 }).width || 595;
            const png = await renderPageAsImage(pdf, page, { canvasImport: () => import("@napi-rs/canvas"), scale: Math.min(6, 2500 / width) });
            const r = await tesseract(Buffer.from(png));
            parts.push(r.text);
            confidences.push(r.confidence);
          }
          text = parts.join("\n");
          confidence = confidences.length ? Math.min(...confidences) : null;
          engine = "tesseract";
        }
      }
    } else if (mime.startsWith("image/")) {
      if (serverEnv.googleVisionApiKey) {
        text = await visionAnnotate(bytes, mime);
        engine = "google-vision";
      } else if (/image\/(png|jpe?g|webp|bmp|gif)/.test(mime)) {
        const r = await tesseract(bytes);
        text = r.text;
        confidence = r.confidence;
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
    return { status: "done", text, engine, fields: extractFields(text, opts), confidence };
  } catch (e) {
    console.error("[ocr]", e);
    return { status: "failed", text: "", engine: "none", fields: empty, message: (e as Error).message };
  }
}
