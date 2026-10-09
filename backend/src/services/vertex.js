const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// Ruta relativa a tu archivo JSON local
const keyPath = path.join(__dirname, '../../credentials/vertex-service-account.json');

const vertexConfig = {
  project: process.env.GCP_PROJECT_ID || 'smartflow-506917',
  location: process.env.GCP_LOCATION || 'us-central1',
};

// Si el archivo JSON existe (entorno local), usa las credenciales del archivo
if (fs.existsSync(keyPath)) {
  vertexConfig.keyFilename = keyPath;
}
// Si NO existe (Cloud Run), VertexAI se autentica automáticamente con ADC

const vertexAI = new VertexAI(vertexConfig);
const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

module.exports = { generativeModel };