-- =====================================================================
-- SmartFlow AI — Datos de ejemplo (seed)
-- Correr DESPUÉS de schema.sql: psql -U postgres -d smartflow_db -f db/seed.sql
-- =====================================================================

INSERT INTO organizaciones (nombre, tipo_industria, jerarquia) VALUES
  ('SmartFlow Demo S.A.', 'Servicios', ARRAY['Empleado','Jefe de Área','Gerencia','Dirección']);

-- Contraseña real para ambos: "smartflow123" (ya hasheada con bcrypt, costo 10)
INSERT INTO usuarios (organizacion_id, nombre, email, password_hash, rol) VALUES
  (1, 'Sofía Dávila',   'sofia@smartflow.ai',  '$2b$10$s0DlWBBZ96rDV38w9cWKsOlsKEdPkqj1XHhtApz9LvvVdOLFuotFC', 'admin'),
  (1, 'Wilder Cardoza', 'wilder@smartflow.ai', '$2b$10$s0DlWBBZ96rDV38w9cWKsOlsKEdPkqj1XHhtApz9LvvVdOLFuotFC', 'usuario');

INSERT INTO flujos (id, organizacion_id, propietario_id, nombre, estado, tipo, pasos) VALUES
  (1, 1, 1, 'Solicitud de Vacaciones', 'Activo',   'especifico', 7),
  (2, 1, 1, 'Aprobación de Beneficio', 'Activo',   'especifico', 4),
  (3, 1, 2, 'Revisión de Gastos',      'Borrador', 'general',    5);

-- Nodos del flujo 1 ("Solicitud de Vacaciones")
INSERT INTO nodos_flujo (id, flujo_id, nodo_key, etiqueta, tipo, orden, posicion_x, posicion_y) VALUES
  (1, 1, '1', 'Solicitud de Vacaciones (Empleado)', 'inicio',   0, 250, 0),
  (2, 1, '2', '¿Aprobación de Dirección?',          'decision', 1, 250, 120),
  (3, 1, '3', 'Notificar Empleado',                 'fin',      2, 130, 240),
  (4, 1, '4', 'Revisión de RRHH',                   'paso',     3, 370, 240),
  (5, 1, '5', 'Verificación de Días Restantes',     'paso',     4, 370, 360),
  (6, 1, '6', 'Visto Bueno Final',                  'decision', 5, 370, 480),
  (7, 1, '7', 'Notificar Rechazo',                  'fin',      6, 370, 600);

INSERT INTO conexiones_flujo (conexion_key, flujo_id, nodo_origen_id, nodo_destino_id, etiqueta) VALUES
  ('e1-2', 1, 1, 2, ''),
  ('e2-3', 1, 2, 3, 'No'),
  ('e2-4', 1, 2, 4, 'Sí'),
  ('e4-5', 1, 4, 5, ''),
  ('e5-6', 1, 5, 6, ''),
  ('e6-7', 1, 6, 7, 'No');

-- Un reporte de IA ya generado y guardado (Fase 4)
INSERT INTO insights_ia (flujo_id, organizacion_id, generado_por, titulo, reporte_texto, optimizacion, sugerencia, ahorro_estimado_horas) VALUES
  (1, 1, 1, 'Reporte de Eficiencia — Solicitud de Vacaciones',
   'Este proceso tiene 7 pasos y un cuello de botella principal en la revisión de RRHH (72h en promedio). ' ||
   'Se recomienda automatizar la verificación de días restantes integrando el sistema de nómina.',
   'El paso "Revisión de RRHH" tiene un tiempo promedio de 72 horas.',
   'Automatizar la verificación de días restantes mediante integración con el sistema de nómina.', 48);

-- Cuellos de botella
INSERT INTO cuellos_de_botella (flujo_id, nodo_id, descripcion_paso, tiempo_promedio_horas, riesgo) VALUES
  (1, 4, 'Revisión de RRHH',            72, 'Alto'),
  (3, NULL, 'Aprobación de Presupuesto', 48, 'Medio'),
  (2, NULL, 'Validación de Documentos',  24, 'Bajo');

-- Una tarea de ejemplo ligada a un nodo
INSERT INTO tareas (flujo_id, nodo_id, titulo, estado, fecha_limite, asignado_a) VALUES
  (1, 4, 'Revisar solicitud de vacaciones de Wilder', 'Pendiente', CURRENT_DATE + INTERVAL '3 days', 1);

-- Reajustar los contadores SERIAL (insertamos ids a mano arriba)
SELECT setval('organizaciones_id_seq', (SELECT MAX(id) FROM organizaciones));
SELECT setval('usuarios_id_seq',       (SELECT MAX(id) FROM usuarios));
SELECT setval('flujos_id_seq',         (SELECT MAX(id) FROM flujos));
SELECT setval('nodos_flujo_id_seq',    (SELECT MAX(id) FROM nodos_flujo));
SELECT setval('conexiones_flujo_id_seq', (SELECT MAX(id) FROM conexiones_flujo));
SELECT setval('insights_ia_id_seq',    (SELECT MAX(id) FROM insights_ia));
SELECT setval('cuellos_de_botella_id_seq', (SELECT MAX(id) FROM cuellos_de_botella));
SELECT setval('tareas_id_seq',         (SELECT MAX(id) FROM tareas));
