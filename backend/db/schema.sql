-- =====================================================================
-- SmartFlow AI — Esquema de base de datos (PostgreSQL) — DESDE CERO
-- =====================================================================
-- Nombres de tabla/columna EN ESPAÑOL, a propósito: así coinciden 1:1
-- con lo que ya esperan auth.controller.js y flows.controller.js
-- (usuarios, organizaciones, flujos, nodos_flujo, conexiones_flujo),
-- y con el diagrama entidad-relación del proyecto.
--
-- Cómo aplicarlo (con el usuario/base que ya tienes en tu .env):
--   dropdb  smartflow_db   -- (si ya existía y quieres empezar limpio)
--   createdb smartflow_db
--   psql -U postgres -d smartflow_db -f db/schema.sql
--   psql -U postgres -d smartflow_db -f db/seed.sql      -- datos de ejemplo
-- =====================================================================

DROP TABLE IF EXISTS archivos_adjuntos CASCADE;
DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS ejecuciones_flujo CASCADE;
DROP TABLE IF EXISTS insights_ia CASCADE;
DROP TABLE IF EXISTS cuellos_de_botella CASCADE;
DROP TABLE IF EXISTS conexiones_flujo CASCADE;
DROP TABLE IF EXISTS nodos_flujo CASCADE;
DROP TABLE IF EXISTS flujos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS organizaciones CASCADE;
DROP VIEW IF EXISTS org_kpis CASCADE;

-- ---------------------------------------------------------------------
-- 1) organizaciones
-- ---------------------------------------------------------------------
-- No está dibujada en el diagrama que mandaste, pero SÍ es indispensable:
-- auth.controller.js (login/register) y flows.controller.js ya la usan
-- (organizacion_id) para que cada empresa vea solo sus propios datos, y
-- "jerarquia" es el contexto que se le pasa a la IA (ver ai.service.js)
-- para que no invente roles que esa empresa no tiene (gerente, junta
-- directiva, etc.) — lo que armamos en la fase anterior.
CREATE TABLE organizaciones (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(150) NOT NULL,
  tipo_industria  VARCHAR(100) NOT NULL DEFAULT 'General',
  jerarquia       TEXT[] NOT NULL DEFAULT '{}',
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2) usuarios   (== "Usuarios" del diagrama)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id               SERIAL PRIMARY KEY,
  organizacion_id  INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  nombre           VARCHAR(150) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  rol              VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'usuario')),
  creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_organizacion ON usuarios(organizacion_id);

-- ---------------------------------------------------------------------
-- 3) flujos   (== "Flujos" del diagrama; propietario_id = relación "inicia")
-- ---------------------------------------------------------------------
CREATE TABLE flujos (
  id                SERIAL PRIMARY KEY,
  organizacion_id   INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  propietario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre            VARCHAR(150) NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Activo', 'Borrador')),
  tipo              VARCHAR(20) NOT NULL DEFAULT 'especifico' CHECK (tipo IN ('general', 'especifico')),
  pasos             INTEGER NOT NULL DEFAULT 0,
  creado_en         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flujos_organizacion ON flujos(organizacion_id);
CREATE INDEX idx_flujos_propietario ON flujos(propietario_id);

-- ---------------------------------------------------------------------
-- 4) nodos_flujo   (== "Nodos_Flujo" del diagrama)
-- ---------------------------------------------------------------------
-- "nodo_key" es el id LOCAL que usa React Flow dentro de ese diagrama
-- ("1","2","manual-172..."), distinto del id numérico interno de la BD.
CREATE TABLE nodos_flujo (
  id          SERIAL PRIMARY KEY,
  flujo_id    INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  nodo_key    VARCHAR(50) NOT NULL,
  etiqueta    VARCHAR(255) NOT NULL,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('inicio', 'paso', 'decision', 'fin')),
  orden       INTEGER NOT NULL DEFAULT 0,
  posicion_x  REAL,
  posicion_y  REAL,
  UNIQUE (flujo_id, nodo_key)
);

CREATE INDEX idx_nodos_flujo_flujo ON nodos_flujo(flujo_id);

-- ---------------------------------------------------------------------
-- 5) conexiones_flujo   (== "Conexiones_Flujo" del diagrama)
-- ---------------------------------------------------------------------
-- origen_handle/destino_handle: de qué lado del nodo sale/entra la flecha
-- en el lienzo (top/bottom/left/right) — tal como lo dibujaste en el
-- diagrama. Son opcionales: React Flow los pone solo cuando el usuario
-- conecta nodos a mano con handles específicos.
CREATE TABLE conexiones_flujo (
  id                SERIAL PRIMARY KEY,
  conexion_key      VARCHAR(50) NOT NULL,
  flujo_id          INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  nodo_origen_id    INTEGER NOT NULL REFERENCES nodos_flujo(id) ON DELETE CASCADE,
  nodo_destino_id   INTEGER NOT NULL REFERENCES nodos_flujo(id) ON DELETE CASCADE,
  etiqueta          VARCHAR(50),   -- "Sí" / "No" / vacío
  origen_handle     VARCHAR(20),
  destino_handle    VARCHAR(20),
  UNIQUE (flujo_id, conexion_key)
);

CREATE INDEX idx_conexiones_flujo_flujo ON conexiones_flujo(flujo_id);
CREATE INDEX idx_conexiones_flujo_origen ON conexiones_flujo(nodo_origen_id);
CREATE INDEX idx_conexiones_flujo_destino ON conexiones_flujo(nodo_destino_id);

-- ---------------------------------------------------------------------
-- 6) ejecuciones_flujo   (== "Ejecuciones_Flujo" del diagrama)
-- ---------------------------------------------------------------------
-- Una "corrida" real de un flujo (alguien lo empieza a ejecutar en la
-- práctica, no solo lo diseña). Todavía no hay pantalla en el frontend
-- para esto — queda lista la tabla para cuando se implemente.
CREATE TABLE ejecuciones_flujo (
  id             SERIAL PRIMARY KEY,
  flujo_id       INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  iniciado_por   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin      TIMESTAMP,
  estado         VARCHAR(20) NOT NULL DEFAULT 'En progreso'
                   CHECK (estado IN ('En progreso', 'Completado', 'Cancelado')),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_ejecuciones_flujo_flujo ON ejecuciones_flujo(flujo_id);

-- ---------------------------------------------------------------------
-- 7) tareas   (== "Tareas" del diagrama)
-- ---------------------------------------------------------------------
-- Una tarea concreta asociada a un paso (nodo) de un flujo, asignada a
-- un usuario. Ej: "Revisar solicitud" asignada a Wilder, vence el 20/09.
CREATE TABLE tareas (
  id             SERIAL PRIMARY KEY,
  flujo_id       INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  nodo_id        INTEGER REFERENCES nodos_flujo(id) ON DELETE SET NULL,
  titulo         VARCHAR(255) NOT NULL,
  estado         VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Pendiente', 'En progreso', 'Completada')),
  fecha_limite   DATE,
  asignado_a     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tareas_flujo ON tareas(flujo_id);
CREATE INDEX idx_tareas_asignado ON tareas(asignado_a);

-- ---------------------------------------------------------------------
-- 8) archivos_adjuntos   (== "Archivos_Adjuntos" del diagrama)
-- ---------------------------------------------------------------------
CREATE TABLE archivos_adjuntos (
  id               SERIAL PRIMARY KEY,
  flujo_id         INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  tarea_id         INTEGER REFERENCES tareas(id) ON DELETE CASCADE,
  nombre_archivo   VARCHAR(255) NOT NULL,
  tipo_mime        VARCHAR(100),
  subido_por       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  subido_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_archivos_adjuntos_flujo ON archivos_adjuntos(flujo_id);
CREATE INDEX idx_archivos_adjuntos_tarea ON archivos_adjuntos(tarea_id);

-- ---------------------------------------------------------------------
-- 9) cuellos_de_botella   (== "Cuellos_de_Botella" del diagrama)
-- ---------------------------------------------------------------------
CREATE TABLE cuellos_de_botella (
  id                      SERIAL PRIMARY KEY,
  flujo_id                INTEGER NOT NULL REFERENCES flujos(id) ON DELETE CASCADE,
  nodo_id                 INTEGER REFERENCES nodos_flujo(id) ON DELETE SET NULL,
  descripcion_paso        VARCHAR(255) NOT NULL,
  tiempo_promedio_horas   NUMERIC(6,1) NOT NULL CHECK (tiempo_promedio_horas >= 0),
  riesgo                  VARCHAR(10) NOT NULL CHECK (riesgo IN ('Alto', 'Medio', 'Bajo')),
  detectado_en            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cuellos_flujo ON cuellos_de_botella(flujo_id);

-- ---------------------------------------------------------------------
-- 10) insights_ia   (== "Insights_IA" del diagrama — reportes guardados)
-- ---------------------------------------------------------------------
-- "reporte_texto" es TEXT (sin límite de longitud, el equivalente a un
-- CLOB): aquí se guarda el reporte COMPLETO generado por Gemini de forma
-- permanente, para no tener que volver a llamar a la IA para releerlo.
CREATE TABLE insights_ia (
  id                      SERIAL PRIMARY KEY,
  flujo_id                INTEGER REFERENCES flujos(id) ON DELETE SET NULL,
  organizacion_id         INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  generado_por            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo                  VARCHAR(255) NOT NULL,
  reporte_texto           TEXT NOT NULL,
  optimizacion            TEXT,
  sugerencia              TEXT,
  ahorro_estimado_horas   INTEGER,
  generated_en            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insights_ia_organizacion ON insights_ia(organizacion_id, generated_en DESC);
CREATE INDEX idx_insights_ia_flujo ON insights_ia(flujo_id);

-- ---------------------------------------------------------------------
-- KPIs del Dashboard: se CALCULAN, no se guardan en una tabla estática
-- ---------------------------------------------------------------------
CREATE VIEW org_kpis AS
SELECT
  o.id AS organizacion_id,
  COUNT(f.id) FILTER (WHERE f.estado = 'Activo')  AS flujos_activos,
  COUNT(f.id)                                     AS flujos_totales,
  COALESCE((
    SELECT SUM(i.ahorro_estimado_horas)
    FROM insights_ia i WHERE i.organizacion_id = o.id
  ), 0) AS horas_ahorradas_totales,
  ROUND(COALESCE((
    SELECT AVG(i.ahorro_estimado_horas)
    FROM insights_ia i WHERE i.organizacion_id = o.id
  ), 0)) AS score_optimizacion_promedio
FROM organizaciones o
LEFT JOIN flujos f ON f.organizacion_id = o.id
GROUP BY o.id;

-- ---------------------------------------------------------------------
-- Trigger genérico: mantiene "actualizado_en" al día en cada UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizaciones_actualizado_en
  BEFORE UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TRIGGER trg_flujos_actualizado_en
  BEFORE UPDATE ON flujos
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
