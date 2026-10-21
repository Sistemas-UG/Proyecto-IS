import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function signToken(user) {
  return jwt.sign(
    { id: user.id, organizationId: user.organizationId, rol: user.rol },
    process.env.JWT_SECRET || 'secret_key_demo',
    { expiresIn: '8h' }
  );
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email y contraseña son requeridos.");
  }

  const result = await pool.query(
    `SELECT id, nombre, email, password_hash, rol, organizacion_id AS "organizationId"
     FROM usuarios WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new ApiError(401, "Credenciales inválidas.");
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new ApiError(401, "Credenciales inválidas.");
  }

  const token = signToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.rol,
      organizationId: user.organizationId,
    },
  });
});

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { nombre_completo, nombre, email, password } = req.body;
  const nombreFinal = nombre_completo || nombre;

  if (!nombreFinal || !email || !password) {
    throw new ApiError(400, "Nombre, correo y contraseña son requeridos.");
  }

  const existing = await pool.query(`SELECT id FROM usuarios WHERE email = $1`, [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, "Ya existe una cuenta con ese correo.");
  }

  const orgResult = await pool.query(
    `SELECT id FROM organizaciones ORDER BY creado_en ASC LIMIT 1`
  );
  if (orgResult.rows.length === 0) {
    throw new ApiError(
      500,
      "No hay ninguna organización creada todavía. Pide a un administrador que cree una antes de registrarte."
    );
  }
  const organizacionId = orgResult.rows[0].id;

  const passwordHash = await bcrypt.hash(password, 10);

  const insertResult = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, organizacion_id)
     VALUES ($1, $2, $3, 'usuario', $4)
     RETURNING id, nombre, email, rol, organizacion_id AS "organizationId"`,
    [nombreFinal, email, passwordHash, organizacionId]
  );

  const user = insertResult.rows[0];
  const token = signToken(user);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.rol,
      organizationId: user.organizationId,
    },
  });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "El correo electrónico es requerido.");
  }

  const userResult = await pool.query('SELECT id, nombre, email FROM usuarios WHERE email = \$1', [email]);
  
  // Por seguridad, devolvemos respuesta exitosa aunque el correo no exista en la BD
  if (userResult.rows.length === 0) {
    return res.json({ 
      message: "Se ha enviado un correo con las instrucciones si la cuenta existe." 
    });
  }

  const user = userResult.rows[0];

  // Generar token aleatorio único
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Expira en 30 minutos

  // Limpiar tokens anteriores e insertar el nuevo token
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = \$1', [user.id]);
  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (\$1, \$2, \$3)',
    [user.id, tokenHash, expiresAt]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'https://smartflow-frontend-1020540188448.us-central1.run.app';
  const resetLink = `${frontendUrl}/#/restablecer-contrasena?token=${resetToken}`;

  // Configuración del correo con Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"SmartFlow AI" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: 'Restablecer contraseña - SmartFlow AI',
    html: `
      <div style="background-color: #0f172a; padding: 30px; font-family: sans-serif; color: #ffffff; text-align: center; border-radius: 10px;">
        <h2 style="color: #3b82f6;">SmartFlow AI</h2>
        <h3>Restablecimiento de Contraseña</h3>
        <p style="color: #94a3b8;">Hola ${user.nombre}, recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p style="color: #94a3b8;">Haz clic en el siguiente botón para continuar:</p>
        <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 20px 0;">Restablecer Contraseña</a>
        <p style="color: #64748b; font-size: 12px;">Este enlace expirará en 30 minutos. Si no solicitaste este cambio, puedes ignorar este correo.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);

  res.json({ 
    message: "Se ha enviado un correo con las instrucciones si la cuenta existe." 
  });
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, password } = req.body;
  const finalPassword = newPassword || password;

  if (!token || !finalPassword) {
    throw new ApiError(400, "El token y la nueva contraseña son requeridos.");
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Buscar token válido que no haya expirado
  const tokenResult = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = \$1 AND expires_at > NOW()',
    [tokenHash]
  );

  if (tokenResult.rows.length === 0) {
    throw new ApiError(400, "El token de recuperación es inválido o ha expirado.");
  }

  const resetRecord = tokenResult.rows[0];
  const newPasswordHash = await bcrypt.hash(finalPassword, 10);

  // Actualizar contraseña en la columna 'password_hash' y eliminar el token
  await pool.query('UPDATE usuarios SET password_hash = \$1 WHERE id = \$2', [newPasswordHash, resetRecord.user_id]);
  await pool.query('DELETE FROM password_reset_tokens WHERE id = \$1', [resetRecord.id]);

  res.json({ 
    message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." 
  });
});