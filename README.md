SmartFlow AI — Estado actual del proyecto

Proyecto de FISICC (Ingeniería de Software) para automatizar y optimizar procesos de
negocio con IA. Genera diagramas de flujo a partir de descripciones en lenguaje
natural (Vertex AI / Gemini), detecta cuellos de botella y genera reportes.

**Stack:** React + Vite + Tailwind + React Flow (frontend) · Node.js + Express,
módulos ES (backend) · PostgreSQL en Cloud SQL · Vertex AI (Gemini) · Google Cloud
Storage · despliegue en Cloud Run vía Cloud Build.

## 1. Levantar el backend

```bash
cd backend
npm install
# Configura tu .env (ver sección "Variables de entorno" más abajo)
npm run dev
```

Corre en `http://localhost:4000`. Prueba: `curl http://localhost:4000/api/health`
→ `{"status":"ok"}`

## 2. Levantar el frontend (otra terminal)

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```

Abrir `http://localhost:5173`.

## 3. Iniciar sesión

Ya **no hay usuarios de prueba hardcodeados** — el login valida contra la tabla
`usuarios` en PostgreSQL (Cloud SQL), con contraseñas cifradas con `bcryptjs` y
sesión real por JWT. Regístrate desde la pantalla de registro o usa una cuenta
que ya exista en la base de datos.

## Cómo está conectado

- **`Frontend/src/lib/api.js`** — cliente HTTP único, lee `VITE_API_URL` y agrega
  el header `Authorization: Bearer <token>` automáticamente.
- **`Frontend/src/lib/AuthContext.jsx`** — guarda el token en `localStorage`,
  expone `login()` / `logout()` / `user`, valida sesión contra `GET /api/auth/me`.
- **`App.jsx`** — rutas privadas envueltas en `<ProtectedRoute>`.
- **`Login.jsx`** → `POST /api/auth/login`, `POST /api/auth/register`, y el flujo
  de recuperación de contraseña (`POST /api/auth/forgot-password`).
- **`ResetPassword.jsx`** → `POST /api/auth/reset-password`, ruta
  `/restablecer-contrasena?token=...`.
- **`Dashboard.jsx`** → `GET /api/dashboard/kpis` + `GET /api/dashboard/recent-flows`
- **`MisFlujos.jsx`** → `GET /api/flows`
- **`CrearFlujo.jsx`** → `POST /api/ai/generate-flow` (Vertex AI / Gemini genera el
  flujo real; el layout se ordena automáticamente con `dagre`). El botón
  "Guardar en Mis Flujos" hace `POST /api/flows`.
- **`Reportes.jsx`** → `GET /api/reports/summary` + `GET /api/reports/bottlenecks`
- **`Configuracion.jsx`** → `GET /api/users` + datos del usuario logueado

## Lo que ya está implementado

1. **PostgreSQL real** en Cloud SQL (ya no arreglo en memoria) — tablas de
   organizaciones, usuarios, flujos, nodos, conexiones, tareas, archivos
   adjuntos, cuellos de botella e insights de IA.
2. **Autenticación real** — JWT (`jsonwebtoken`) + contraseñas cifradas con
   `bcryptjs` (ya no el token demo `demo-token::<id>`).
3. **Vertex AI + Gemini** conectado en `backend/src/services/ai.service.js`
   para generar los flujos a partir del texto del usuario.
4. **Auto-layout de diagramas** con `dagre` — los nodos del flujo generado salen
   ordenados en vez de encimados.
5. **Google Cloud Storage** para archivos adjuntos, con URLs firmadas (V4) en
   vez de públicas.
6. **Despliegue en Cloud Run** (backend y frontend), con build vía Cloud Build
   y Dockerfiles propios (el frontend se sirve con nginx sobre el build de Vite).
7. **Cloud Monitoring** — dashboard básico configurado para el proyecto.
8. **Recuperación de contraseña por correo** — recién implementada: token
   aleatorio (hash guardado en `password_reset_tokens`, expira en 30 min),
   envío por Gmail/Nodemailer, validación con transacción en Postgres.
   *(En fase de prueba end-to-end, aún no confirmada 100% funcionando.)*

## Pendiente / en progreso

- Confirmar que el flujo completo de recuperación de contraseña funciona de
  principio a fin (correo llega, link funciona, contraseña se actualiza).
- Confirmar el redeploy del frontend en Cloud Run tras el fix del Dockerfile.
- Evaluar si hace falta redesplegar `smartflow-backend` con los cambios más
  recientes del backend.
- Generación real de PDF/Word desde `CrearFlujo.jsx` (reportes descargables).

## Variables de entorno (backend)

No se versiona el `.env` real. Variables que usa el backend:

```
PORT, NODE_ENV, CORS_ORIGIN, FRONTEND_URL
DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DB_HOST, INSTANCE_CONNECTION_NAME
GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GEMINI_MODEL, GOOGLE_APPLICATION_CREDENTIALS
GCS_BUCKET_NAME
JWT_SECRET
GMAIL_USER, GMAIL_APP_PASSWORD
```
