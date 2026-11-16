import { generarPasswordTemporal, hashPassword } from '../../security/password.js';

/**
 * HU02 — Genera una credencial temporal: contraseña de 6 caracteres (CSPRNG), su hash Argon2id y su vigencia.
 * La contraseña en claro solo existe en memoria para enviarla por correo; no se almacena ni se registra.
 */
export async function generarCredencialTemporal(cfg) {
  const passwordTemporal = generarPasswordTemporal();
  return {
    passwordTemporal,
    passwordHash: await hashPassword(passwordTemporal),
    passwordExpiraEn: new Date(Date.now() + cfg.tempPasswordHours * 3600_000),
  };
}
