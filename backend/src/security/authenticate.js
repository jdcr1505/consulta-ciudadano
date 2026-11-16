import { unauthorized, forbidden } from '../common/errors.js';
import { verifyAccessToken } from './tokens.js';

// Rutas permitidas mientras el usuario debe cambiar su contraseña temporal (CA08).
const PERMITIDAS_CAMBIO = new Set(['/api/v1/auth/cambiar-password', '/api/v1/auth/logout', '/api/v1/auth/me']);

export function authenticate({ prisma, cfg }) {
  return async (req, _res, next) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());
    let payload;
    try {
      payload = verifyAccessToken(cfg, token);
    } catch {
      return next(unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada'));
    }
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(payload.sub) },
      include: { rol: { include: { permisos: { include: { permiso: true } } } } },
    });
    if (!usuario || usuario.estado !== 'ACTIVO') return next(unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada'));
    req.user = {
      id: usuario.id,
      identificacion: usuario.identificacion,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      rolId: usuario.rolId,
      rol: usuario.rol.nombre,
      permisos: new Set(usuario.rol.permisos.map((rp) => rp.permiso.codigo)),
      debeCambiarPassword: usuario.debeCambiarPassword,
    };
    const ruta = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    if (usuario.debeCambiarPassword && !PERMITIDAS_CAMBIO.has(ruta)) {
      return next(forbidden('CAMBIO_PASSWORD_REQUERIDO', 'Debe cambiar su contraseña temporal antes de continuar'));
    }
    next();
  };
}

// Autorización en el servidor por permiso (opción:acción). La interfaz solo oculta opciones.
export const authorize = (...codigos) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!codigos.some((c) => req.user.permisos.has(c))) return next(forbidden());
  next();
};
