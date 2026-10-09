import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

dotenv.config();

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días (máximo que permite una URL firmada V4)

/**
 * Sube un buffer a Google Cloud Storage y devuelve una URL firmada de
 * lectura, en vez de la URL pública. El bucket se queda privado: solo quien
 * tenga ese link puede abrir el archivo (nadie puede listar el bucket ni
 * adivinar otros archivos), y el link deja de funcionar a los 7 días.
 */
export const uploadBufferToGCS = (buffer, destinationPath, mimeType) => {
  return new Promise((resolve, reject) => {
    const file = bucket.file(destinationPath);
    const stream = file.createWriteStream({
      metadata: { contentType: mimeType },
      resumable: false,
    });

    stream.on("error", (err) => reject(err));
    stream.on("finish", async () => {
      try {
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + SIGNED_URL_TTL_MS,
        });
        resolve({ fileName: file.name, url, expiraEnDias: 7 });
      } catch (err) {
        reject(err);
      }
    });

    stream.end(buffer);
  });
};