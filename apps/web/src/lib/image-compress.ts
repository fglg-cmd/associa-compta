/**
 * Réduit une photo avant l'envoi (dans le navigateur) : 2 000 px maximum, JPEG 85 %.
 * Une photo de téléphone (3 à 6 Mo) passe à environ 300–600 Ko : envoi bien plus rapide
 * en 4G et lecture automatique plus rapide, avec un justificatif toujours parfaitement lisible.
 * En cas d'échec (format non décodable comme le HEIC sur certains navigateurs), le fichier
 * d'origine est envoyé tel quel.
 */
const MAX_SIDE = 2000;
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/;

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) || file.size < 700_000 || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
