import 'dotenv/config';
import { Storage } from "@google-cloud/storage";

async function testStorageConnection() {
  const bucketName = process.env.GCS_BUCKET_NAME;

  console.log(" Bucket detectado:", bucketName);

  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });

  const bucket = storage.bucket(bucketName);

  console.log(" Subiendo archivo de prueba...");

  try {
    const fileName = `pruebas/test-${Date.now()}.txt`;
    const file = bucket.file(fileName);
    const contenidoPrueba = "Hola desde SmartFlow AI! Conexión a GCS exitosa.";

    // Guardar el archivo directamente
    await file.save(contenidoPrueba, { contentType: "text/plain" });
    console.log("¡Archivo subido con éxito!");

    const [metadata] = await file.getMetadata();
    console.log(" Información del archivo en la nube:", {
      nombre: metadata.name,
      tamaño: `${metadata.size} bytes`,
      creado: metadata.timeCreated,
    });

    console.log("\n ¡Prueba de Storage completada al 100%!");
  } catch (error) {
    console.error("\n Error durante la subida:", error.message);
  }
}

testStorageConnection();