import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

dotenv.config();

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * Sube un buffer/archivo directamente a Google Cloud Storage
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
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      resolve({ fileName: file.name, url: publicUrl });
    });

    stream.end(buffer);
  });
};