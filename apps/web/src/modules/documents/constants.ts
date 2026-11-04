export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "Image",
  "image/png": "Image",
  "image/webp": "Image",
  "image/heic": "Image",
  "image/gif": "Image",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "application/vnd.oasis.opendocument.text": "Texte",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.oasis.opendocument.spreadsheet": "Tableur",
};

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const DEFAULT_FOLDERS = ["Justificatifs", "Factures", "Subventions", "Statuts et PV", "Banque", "Assurances", "Contrats", "Divers"];
