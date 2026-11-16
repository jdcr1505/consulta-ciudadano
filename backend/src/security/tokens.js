import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';

export const signAccessToken = (cfg, usuario) =>
  jwt.sign({ sub: String(usuario.id) }, cfg.jwtAccessSecret, {
    algorithm: 'HS256',
    expiresIn: `${cfg.accessTokenMinutes}m`,
    issuer: 'consulta-ciudadano',
  });

export function verifyAccessToken(cfg, token) {
  return jwt.verify(token, cfg.jwtAccessSecret, { algorithms: ['HS256'], issuer: 'consulta-ciudadano' });
}

// Refresh token opaco de 256 bits; en BD solo se guarda su hash SHA-256.
export const newRefreshToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(t).digest('hex');
