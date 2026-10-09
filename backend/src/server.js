import app from "./app.js";
import { env, assertRequiredEnv } from "./config/env.js";

assertRequiredEnv();

app.listen(env.port, () => {
  console.log(` SmartFlow AI backend corriendo en http://localhost:${env.port}`);
  console.log(`   CORS habilitado para: ${env.corsOrigin}`);
});
