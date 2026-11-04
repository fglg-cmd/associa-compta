import { BankImportError, decodeBankFile, type ParseResult } from "./common";
import { parseCsv, type CsvMapping } from "./csv";
import { parseOfx } from "./ofx";
import { parseQif } from "./qif";

export * from "./common";
export * from "./csv";
export * from "./ofx";
export * from "./qif";
export * from "./rules";

export type BankFileFormat = "csv" | "ofx" | "qif";

export function detectFormat(filename: string, text: string): BankFileFormat {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "ofx" || ext === "qfx" || /<OFX>/i.test(text.slice(0, 4000)) || /^OFXHEADER/m.test(text.slice(0, 200))) return "ofx";
  if (ext === "qif" || /^!Type:/im.test(text.slice(0, 200))) return "qif";
  if (ext === "csv" || ext === "txt" || ext === "tsv") return "csv";
  throw new BankImportError("Format non pris en charge : utilisez un fichier CSV, OFX ou QIF.");
}

export const MAX_BANK_FILE_BYTES = 5 * 1024 * 1024;

/** Point d'entrée unique : octets du fichier → opérations normalisées. */
export function parseBankFile(filename: string, bytes: Uint8Array, csvMapping?: CsvMapping): ParseResult {
  if (bytes.byteLength === 0) throw new BankImportError("Le fichier est vide.");
  if (bytes.byteLength > MAX_BANK_FILE_BYTES) throw new BankImportError("Fichier trop volumineux (5 Mo maximum).");
  const text = decodeBankFile(bytes);
  const format = detectFormat(filename, text);
  if (format === "ofx") return parseOfx(text);
  if (format === "qif") return parseQif(text);
  return parseCsv(text, csvMapping);
}
