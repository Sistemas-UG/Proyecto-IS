import pool from './src/config/db.js';

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as fecha, current_database() as bd;');
    console.log('✅ Conexión a PostgreSQL exitosa!');
    console.log('Base de datos:', res.rows[0].bd);
    console.log('Fecha del servidor:', res.rows[0].fecha);
  } catch (err) {
    console.error('❌ Error al conectar a PostgreSQL:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();