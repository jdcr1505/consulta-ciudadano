import { AppError, badRequest, unauthorized } from '../../common/errors.js';
import { cumplePolitica, dummyVerify, hashPassword, MENSAJE_POLITICA, verifyPassword } from '../../security/password.js';
import { hashToken, newRefreshToken, signAccessToken } from '../../security/tokens.js';

const CREDENCIALES_INVALIDAS = () => unauthorized('CREDENCIALES_INVALIDAS', 'Las credenciales no son válidas');

export function usuarioSesionDTO(u) {
  return {
    id: u.id,
    identificacion: u.identificacion,
    nombres: u.nombres,
    apellidos: u.apellidos,
    rol: u.rol.nombre,
    permisos: u.rol.permisos.map((rp) => rp.permiso.codigo).sort(),
    debeCambiarPassword: u.debeCambiarPassword,
  };
}

const INCLUDE_ROL = { rol: { include: { permisos: { include: { permiso: true } } } } };

export function createAuthService({ prisma, cfg, audit }) {
  async function abrirSesion(usuario, db = prisma) {
    const refreshToken = newRefreshToken();
    await db.sesion.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashToken(refreshToken),
        expiraEn: new Date(Date.now() + cfg.refreshTokenHours * 3600_000),
      },
    });
    return {
      accessToken: signAccessToken(cfg, usuario),
      expiresIn: cfg.accessTokenMinutes * 60,
      refreshToken,
      usuario: usuarioSesionDTO(usuario),
    };
  }

  return {
    async login({ identificacion, password }, ip) {
      const usuario = await prisma.usuario.findUnique({ where: { identificacion }, include: INCLUDE_ROL });
      if (!usuario) {
        await dummyVerify(password);
        await audit.registrar({ accion: 'LOGIN', resultado: 'FALLIDO', ip, detalle: { motivo: 'usuario_inexistente' } });
        throw CREDENCIALES_INVALIDAS();
      }
      const ahora = new Date();
      if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
        await audit.registrar({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'BLOQUEADO', ip });
        throw new AppError(429, 'CUENTA_BLOQUEADA', 'Demasiados intentos fallidos. Intente de nuevo más tarde');
      }
      const ok = await verifyPassword(usuario.passwordHash, password);
      if (!ok) {
        const actualizado = await prisma.usuario.update({
          where: { id: usuario.id },
          data: { intentosFallidos: { increment: 1 } },
        });
        if (actualizado.intentosFallidos >= cfg.maxLoginAttempts) {
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + cfg.lockMinutes * 60_000) },
          });
        }
        await audit.registrar({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'FALLIDO', ip, detalle: { motivo: 'password' } });
        throw CREDENCIALES_INVALIDAS();
      }
      // CA09: usuario inactivo → mismo mensaje genérico, sin revelar la causa.
      if (usuario.estado !== 'ACTIVO') {
        await audit.registrar({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'FALLIDO', ip, detalle: { motivo: 'inactivo' } });
        throw CREDENCIALES_INVALIDAS();
      }
      if (usuario.debeCambiarPassword && usuario.passwordExpiraEn && usuario.passwordExpiraEn < ahora) {
        await audit.registrar({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'FALLIDO', ip, detalle: { motivo: 'temporal_expirada' } });
        throw unauthorized('PASSWORD_TEMPORAL_EXPIRADA', 'La contraseña temporal expiró. Solicite al administrador que la restablezca');
      }
      await prisma.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
      const sesion = await abrirSesion(usuario);
      await audit.registrar({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'OK', ip });
      return sesion;
    },

    async refresh(refreshToken, ip) {
      if (!refreshToken) throw unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada');
      const sesion = await prisma.sesion.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
      if (!sesion) throw unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada');
      if (sesion.revocada) {
        // Reutilización de un token ya rotado: posible robo → se cierran todas las sesiones del usuario.
        await prisma.sesion.updateMany({ where: { usuarioId: sesion.usuarioId }, data: { revocada: true } });
        await audit.registrar({ usuarioId: sesion.usuarioId, accion: 'REFRESH', resultado: 'REUTILIZADO', ip });
        throw unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada');
      }
      if (sesion.expiraEn < new Date()) throw unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada');
      const usuario = await prisma.usuario.findUnique({ where: { id: sesion.usuarioId }, include: INCLUDE_ROL });
      if (!usuario || usuario.estado !== 'ACTIVO') throw unauthorized('TOKEN_INVALIDO', 'Sesión inválida o expirada');
      return prisma.$transaction(async (tx) => {
        await tx.sesion.update({ where: { id: sesion.id }, data: { revocada: true } });
        return abrirSesion(usuario, tx);
      });
    },

    async logout(refreshToken, usuarioId, ip) {
      if (refreshToken) {
        await prisma.sesion.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revocada: true } });
      }
      await audit.registrar({ usuarioId, accion: 'LOGOUT', ip });
    },

    async me(usuarioId) {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: INCLUDE_ROL });
      return usuarioSesionDTO(usuario);
    },

    // CA08: cambio de contraseña (obligatorio en el primer acceso con contraseña temporal).
    async cambiarPassword(usuarioId, { passwordActual, passwordNueva }, ip) {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: INCLUDE_ROL });
      if (!(await verifyPassword(usuario.passwordHash, passwordActual))) {
        await audit.registrar({ usuarioId, accion: 'PASSWORD_CAMBIO', resultado: 'FALLIDO', ip });
        throw badRequest('PASSWORD_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta');
      }
      if (!cumplePolitica(passwordNueva)) {
        throw badRequest('PASSWORD_NO_CUMPLE_POLITICA', MENSAJE_POLITICA);
      }
      if (passwordNueva === passwordActual) {
        throw badRequest('PASSWORD_REPETIDA', 'La contraseña nueva debe ser distinta de la actual');
      }
      const nuevoHash = await hashPassword(passwordNueva);
      return prisma.$transaction(async (tx) => {
        const actualizado = await tx.usuario.update({
          where: { id: usuarioId },
          data: { passwordHash: nuevoHash, debeCambiarPassword: false, passwordExpiraEn: null },
          include: INCLUDE_ROL,
        });
        await tx.sesion.updateMany({ where: { usuarioId }, data: { revocada: true } });
        await audit.registrar({ usuarioId, accion: 'PASSWORD_CAMBIO', resultado: 'OK', ip }, tx);
        return abrirSesion(actualizado, tx);
      });
    },
  };
}
