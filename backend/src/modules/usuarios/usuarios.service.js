import { AppError, badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { exigirPuedeAdministrarRol, ROL_ADMINISTRADOR } from '../../security/privilegios.js';
import { generarCredencialTemporal } from '../auth/credenciales.js';
import { usuariosRepository as repo } from './usuarios.repository.js';

export const ROL_FUNCIONARIO = 'FUNCIONARIO';

export function usuarioDTO(u) {
  return {
    id: u.id,
    identificacion: u.identificacion,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
    estado: u.estado,
    rol: { id: u.rol.id, nombre: u.rol.nombre },
    fuerza: u.fuerza ? { id: u.fuerza.id, nombre: u.fuerza.nombre } : null,
    rango: u.rango ? { id: u.rango.id, nombre: u.rango.nombre } : null,
    idFuerza: u.idFuerza,
    debeCambiarPassword: u.debeCambiarPassword,
    bloqueado: Boolean(u.bloqueadoHasta && u.bloqueadoHasta > new Date()),
    creadoEn: u.creadoEn,
  };
}

/** HU12 — Gestión de usuarios (módulo de seguridad). */
export function createUsuariosService({ prisma, cfg, mail, audit }) {
  const enviarCredencial = async (u, cred) => {
    try {
      await mail.enviarCredenciales({
        para: u.correo,
        nombres: u.nombres,
        identificacion: u.identificacion,
        passwordTemporal: cred.passwordTemporal,
        expiraEn: cred.passwordExpiraEn,
      });
    } catch {
      throw new AppError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo con las credenciales');
    }
  };

  function validarDatosFuerza(rolNombre, { fuerzaPublicaId, rangoId, idFuerza }) {
    if (rolNombre === ROL_FUNCIONARIO && !(fuerzaPublicaId && rangoId && idFuerza)) {
      throw badRequest('DATOS_FUERZA_REQUERIDOS', 'Un funcionario requiere fuerza pública, rango e ID Fuerza');
    }
    if ((fuerzaPublicaId && !rangoId) || (!fuerzaPublicaId && rangoId)) {
      throw badRequest('FUERZA_RANGO_INVALIDO', 'Indique fuerza pública y rango juntos');
    }
  }

  async function exigirRangoDeFuerza(db, { fuerzaPublicaId, rangoId }) {
    if (fuerzaPublicaId && rangoId && !(await repo.rango(db, rangoId, fuerzaPublicaId))) {
      throw badRequest('FUERZA_RANGO_INVALIDO', 'El rango no corresponde a la fuerza pública indicada');
    }
  }

  async function cargar(id) {
    const u = await repo.porId(prisma, id);
    if (!u) throw notFound('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
    return u;
  }

  async function exigirNoEsUltimoAdmin(objetivo) {
    if (objetivo.rol.nombre === ROL_ADMINISTRADOR && objetivo.estado === 'ACTIVO') {
      if ((await repo.administradoresActivosExcepto(prisma, objetivo.id, ROL_ADMINISTRADOR)) === 0) {
        throw conflict('ULTIMO_ADMINISTRADOR', 'Debe existir al menos un administrador activo');
      }
    }
  }

  return {
    async listar({ q, estado, rolId, page, pageSize }) {
      const where = {
        ...(estado && { estado }),
        ...(rolId && { rolId }),
        ...(q && {
          OR: [
            { identificacion: { contains: q } },
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
            { correo: { contains: q.toLowerCase() } },
          ],
        }),
      };
      const [items, total] = await repo.listar(prisma, { where, skip: (page - 1) * pageSize, take: pageSize });
      return { items: items.map(usuarioDTO), total, page, pageSize };
    },

    async obtener(id) {
      return usuarioDTO(await cargar(id));
    },

    async crear(actor, data, ip) {
      const rol = await repo.rol(prisma, data.rolId);
      if (!rol) throw badRequest('ROL_NO_ENCONTRADO', 'El rol indicado no existe');
      await exigirPuedeAdministrarRol(prisma, actor, rol.id);
      const fuerza = { fuerzaPublicaId: data.fuerzaPublicaId ?? null, rangoId: data.rangoId ?? null, idFuerza: data.idFuerza ?? null };
      validarDatosFuerza(rol.nombre, fuerza);
      await exigirRangoDeFuerza(prisma, fuerza);

      const cred = await generarCredencialTemporal(cfg);
      try {
        const usuario = await prisma.$transaction(async (tx) => {
          const creado = await repo.crear(tx, {
            identificacion: data.identificacion,
            nombres: data.nombres,
            apellidos: data.apellidos,
            correo: data.correo,
            rolId: rol.id,
            ...fuerza,
            passwordHash: cred.passwordHash,
            debeCambiarPassword: true,
            passwordExpiraEn: cred.passwordExpiraEn,
          });
          await audit.registrar({ usuarioId: actor.id, accion: 'USUARIO_CREADO', entidad: 'usuario', entidadId: creado.id, ip, detalle: { rol: rol.nombre } }, tx);
          await enviarCredencial(creado, cred);
          return creado;
        });
        return usuarioDTO(usuario);
      } catch (e) {
        if (e?.code === 'P2002') throw conflict('USUARIO_DUPLICADO', 'Ya existe un usuario con esa identificación, correo o ID Fuerza');
        throw e;
      }
    },

    async editar(actor, id, cambios, ip) {
      const objetivo = await cargar(id);
      await exigirPuedeAdministrarRol(prisma, actor, objetivo.rolId);
      const final = {
        fuerzaPublicaId: cambios.fuerzaPublicaId !== undefined ? cambios.fuerzaPublicaId : objetivo.fuerzaPublicaId,
        rangoId: cambios.rangoId !== undefined ? cambios.rangoId : objetivo.rangoId,
        idFuerza: cambios.idFuerza !== undefined ? cambios.idFuerza : objetivo.idFuerza,
      };
      validarDatosFuerza(objetivo.rol.nombre, final);
      await exigirRangoDeFuerza(prisma, final);
      try {
        return usuarioDTO(
          await prisma.$transaction(async (tx) => {
            const u = await repo.actualizar(tx, id, cambios);
            await audit.registrar({ usuarioId: actor.id, accion: 'USUARIO_EDITADO', entidad: 'usuario', entidadId: id, ip, detalle: { campos: Object.keys(cambios) } }, tx);
            return u;
          }),
        );
      } catch (e) {
        if (e?.code === 'P2002') throw conflict('USUARIO_DUPLICADO', 'Ya existe un usuario con ese correo o ID Fuerza');
        throw e;
      }
    },

    async cambiarEstado(actor, id, estado, ip) {
      if (actor.id === id) throw forbidden('OPERACION_SOBRE_SI_MISMO', 'No puede cambiar su propio estado');
      const objetivo = await cargar(id);
      await exigirPuedeAdministrarRol(prisma, actor, objetivo.rolId);
      if (estado === 'INACTIVO') await exigirNoEsUltimoAdmin(objetivo);
      return usuarioDTO(
        await prisma.$transaction(async (tx) => {
          const u = await repo.actualizar(tx, id, { estado });
          if (estado === 'INACTIVO') await repo.revocarSesiones(tx, id);
          await audit.registrar({ usuarioId: actor.id, accion: 'USUARIO_ESTADO', entidad: 'usuario', entidadId: id, ip, detalle: { estado } }, tx);
          return u;
        }),
      );
    },

    async cambiarRol(actor, id, rolId, ip) {
      if (actor.id === id) throw forbidden('OPERACION_SOBRE_SI_MISMO', 'No puede cambiar su propio rol');
      const objetivo = await cargar(id);
      const rolNuevo = await repo.rol(prisma, rolId);
      if (!rolNuevo) throw badRequest('ROL_NO_ENCONTRADO', 'El rol indicado no existe');
      await exigirPuedeAdministrarRol(prisma, actor, objetivo.rolId); // no puede tocar a alguien con más privilegios
      await exigirPuedeAdministrarRol(prisma, actor, rolNuevo.id); // ni asignar más privilegios de los que tiene
      if (rolNuevo.id !== objetivo.rolId) await exigirNoEsUltimoAdmin(objetivo);
      validarDatosFuerza(rolNuevo.nombre, objetivo);
      return usuarioDTO(
        await prisma.$transaction(async (tx) => {
          const u = await repo.actualizar(tx, id, { rolId });
          await audit.registrar({ usuarioId: actor.id, accion: 'USUARIO_ROL', entidad: 'usuario', entidadId: id, ip, detalle: { rolAnterior: objetivo.rol.nombre, rolNuevo: rolNuevo.nombre } }, tx);
          return u;
        }),
      );
    },

    // Restablece la contraseña: nueva temporal con vigencia limitada y cambio obligatorio; desbloquea la cuenta.
    async restablecerPassword(actor, id, ip) {
      if (actor.id === id) throw forbidden('OPERACION_SOBRE_SI_MISMO', 'Use el cambio de contraseña para su propia cuenta');
      const objetivo = await cargar(id);
      await exigirPuedeAdministrarRol(prisma, actor, objetivo.rolId);
      const cred = await generarCredencialTemporal(cfg);
      await prisma.$transaction(async (tx) => {
        await repo.actualizar(tx, id, {
          passwordHash: cred.passwordHash,
          debeCambiarPassword: true,
          passwordExpiraEn: cred.passwordExpiraEn,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        });
        await repo.revocarSesiones(tx, id);
        await audit.registrar({ usuarioId: actor.id, accion: 'PASSWORD_RESTABLECIDA', entidad: 'usuario', entidadId: id, ip }, tx);
        await enviarCredencial(objetivo, cred);
      });
    },
  };
}
