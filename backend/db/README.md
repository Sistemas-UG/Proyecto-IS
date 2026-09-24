# Base de datos — SmartFlow AI (PostgreSQL)

## 1) Crear la base
```bash
createdb smartflow_db
```
(si te pide usuario: `createdb -U postgres smartflow_db`)

## 2) Aplicar el esquema (crea las 10 tablas + la vista `org_kpis`)
```bash
psql -U postgres -d smartflow_db -f db/schema.sql
```

## 3) Cargar datos de ejemplo (opcional, pero recomendado para probar)
```bash
psql -U postgres -d smartflow_db -f db/seed.sql
```
Esto crea la organización demo, 2 usuarios (`sofia@smartflow.ai` / `wilder@smartflow.ai`,
contraseña `smartflow123` para ambos), 3 flujos de ejemplo (uno con nodos y
conexiones completos), un reporte de IA ya guardado y algunos cuellos de botella.

## 4) Configurar el `.env` del backend
Copia `.env.example` a `.env` y completa:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartflow_db
DB_USER=postgres
DB_PASSWORD=<<< tu contraseña real de Postgres, NO la dejes vacía >>>
JWT_SECRET=<<< genera una con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" >>>
```

> Si tu Postgres local no tiene contraseña puesta al usuario `postgres`, puedes
> ponerle una con: `psql -U postgres -c "ALTER USER postgres PASSWORD 'tu-clave';"`

## 5) Probar la conexión
```bash
npm run db:check
```
Debe imprimir `✅ Conexión a PostgreSQL exitosa` y listar las 10 tablas + la vista.
Si falla, el mensaje de error te dice exactamente qué revisar (usuario, password, base, puerto).

## 6) Arrancar el backend
```bash
npm run dev
```

## Estructura de las tablas
| Tabla | Para qué |
|---|---|
| `organizaciones` | Cada empresa: su sector y su jerarquía de roles (contexto para la IA) |
| `usuarios` | Login, con `password_hash` (bcrypt) |
| `flujos` | Los flujos guardados en "Mis Flujos" |
| `nodos_flujo` | Los pasos de cada flujo (React Flow) |
| `conexiones_flujo` | Las flechas entre pasos |
| `ejecuciones_flujo` | Corridas reales de un flujo (para una futura pantalla de "ejecutar") |
| `tareas` | Tareas asignadas a un usuario, ligadas a un paso de un flujo |
| `archivos_adjuntos` | Archivos subidos a una tarea |
| `cuellos_de_botella` | Detectados por la IA, para la pantalla de Reportes |
| `insights_ia` | Reportes completos de IA guardados permanentemente (Fase 4) |
| `org_kpis` (vista) | KPIs del Dashboard, calculados al vuelo — no es una tabla |

## Si quieres empezar totalmente limpio otra vez
```bash
dropdb smartflow_db
createdb smartflow_db
psql -U postgres -d smartflow_db -f db/schema.sql
psql -U postgres -d smartflow_db -f db/seed.sql
```
