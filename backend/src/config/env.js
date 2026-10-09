import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",

  vertex: {
    project:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT_ID ||
      process.env.GCP_PROJECT ||
      "smartflow-506917", // Fallback automático con el ID de tu proyecto de GCP
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
};

// La IA real se activa si hay un ID de proyecto O si estamos corriendo dentro de Cloud Run (K_SERVICE)
export const isVertexConfigured = () =>
  Boolean(env.vertex.project || process.env.K_SERVICE);
