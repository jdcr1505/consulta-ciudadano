import { AppError, badRequest, conflict, notFound } from '../../common/errors.js';
import { ServicioNoDisponibleError } from '../../integrations/defensa/DefensaProvider.js';
import { generarCredencialTemporal } from '../auth/credenciales.js';
import { solicitudesRepository as repo } from './solicitudes.repository.js';

export const ROL_FUNCIONARIO = 'FUNCIONARIO';

const MENSAJES = {
  VALIDADA: 'Su información fue validada. Enviamos una contraseña temporal al correo registrado.',
  PENDIENTE_REVISION:
    'No fue posible validar su información de forma automática. Su solicitud quedó pendiente de revisión por un administrador. Mientras esté pendiente no tendrá acceso al sistema.',
};

export function solicitudDTO(s) {
  return {
    id: s.id,
    identificacion: s.identificacion,
    nombres: s.nombres,
    apellidos: s.apellidos,
    correo: s.correo,
    fuerza: { id: s.fuerza.id, nombre: s.fuerza.nombre },
    rango: { id: s.rango.id, nombre: s.rango.nombre },
    idFuerza: s.idFuerza,
    resultadoValidacion: s.resultadoValidacion,
    estado: s.estado,
    creadaEn: s.creadaEn,
    resueltaEn: s.resueltaEn,
    motivo: s.motivo,
    resueltaPor: s.resolvio ? { id: s.resolvio.id, nombres: s.resolvio.nombres, apellidos: s.resolvio.apellidos } : null,
  };
}

/** HU01 — Registrar solicitud de acceso (con validación simulada contra Defensa) y HU02 — emisión de credenciales. */
export function createSolicitudesService({ prisma, cfg, defensa, mail, audit }) {
  return {
    async crear(data, ip) {
      const rango = await repo.fuerzaConRango(prisma, data.fuerzaPublicaId, data.rangoId);
      if (!rango) throw badRequest('FUERZA_RANGO_INVALIDO', 'El rango seleccionado no corresponde a la fuerza pública indicada');

      if (await repo.usuarioPorIdentificacionOCorreo(prisma, data.identificacion, data.correo)) {
        throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso registrado con la identificación o el correo indicados');
      }
      if (await repo.pendientePorIdentificacion(prisma, data.identificacion)) {
        throw conflict('SOLICITUD_PENDIENTE', 'Ya existe una solicitud pendiente de revisión para esta identificación');
      }

      let resultado;
      try {
        resultado = await defensa.validar({
          identificacion: data.identificacion,
          nombres: data.nombres,
          apellidos: data.apellidos,
          fuerza: rango.fuerza.nombre,
          rango: rango.nombre,
          idFuerza: data.idFuerza,
        });
      } catch (e) {
        if (!(e instanceof ServicioNoDisponibleError)) throw e;
        resultado = 'SERVICIO_NO_DISPONIBLE';
      }

      const base = {
        identificacion: data.identificacion,
        nombres: data.nombres,
        apellidos: data.apellidos,
        correo: data.correo,
        fuerzaPublicaId: data.fuerzaPublicaId,
        rangoId: data.rangoId,
        idFuerza: data.idFuerza,
        resultadoValidacion: resultado,
      };

      try {
        if (resultado !== 'VALIDADO') {
          const s = await prisma.$transaction(async (tx) => {
            const creada = await repo.crearSolicitud(tx, { ...base, estado: 'PENDIENTE_REVISION' });
            await audit.registrar(
              { accion: 'SOLICITUD_CREADA', entidad: 'solicitud', entidadId: creada.id, ip, detalle: { estado: 'PENDIENTE_REVISION', resultado } },
              tx,
            );
            return creada;
          });
          return { solicitudId: s.id, estado: 'PENDIENTE_REVISION', resultadoValidacion: resultado, mensaje: MENSAJES.PENDIENTE_REVISION };
        }

        const cred = await generarCredencialTemporal(cfg);
        const rol = await repo.rolPorNombre(prisma, ROL_FUNCIONARIO);
        const s = await prisma.$transaction(async (tx) => {
          const usuario = await repo.crearUsuarioFuncionario(tx, {
            identificacion: data.identificacion,
            nombres: data.nombres,
            apellidos: data.apellidos,
            correo: data.correo,
            rolId: rol.id,
            fuerzaPublicaId: data.fuerzaPublicaId,
            rangoId: data.rangoId,
            idFuerza: data.idFuerza,
            passwordHash: cred.passwordHash,
            debeCambiarPassword: true,
            passwordExpiraEn: cred.passwordExpiraEn,
          });
          const creada = await repo.crearSolicitud(tx, { ...base, estado: 'VALIDADA', usuarioId: usuario.id });
          await audit.registrar(
            { usuarioId: usuario.id, accion: 'SOLICITUD_CREADA', entidad: 'solicitud', entidadId: creada.id, ip, detalle: { estado: 'VALIDADA' } },
            tx,
          );
          // Si el correo falla, la transacción se revierte: no quedan cuentas sin credenciales entregadas.
          try {
            await mail.enviarCredenciales({
              para: data.correo,
              nombres: data.nombres,
              identificacion: data.identificacion,
              passwordTemporal: cred.passwordTemporal,
              expiraEn: cred.passwordExpiraEn,
            });
          } catch {
            throw new AppError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo con sus credenciales. Intente más tarde');
          }
          return creada;
        });
        return { solicitudId: s.id, estado: 'VALIDADA', resultadoValidacion: 'VALIDADO', mensaje: MENSAJES.VALIDADA };
      } catch (e) {
        if (e?.code === 'P2002') {
          throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso o una solicitud pendiente con los datos indicados');
        }
        throw e;
      }
    },

    // ---------- HU10: gestionar solicitudes ----------
    async listar({ estado, q, page, pageSize }) {
      const where = {
        ...(estado && { estado }),
        ...(q && {
          OR: [
            { identificacion: { startsWith: q } },
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
            { correo: { contains: q.toLowerCase() } },
          ],
        }),
      };
      const [items, total] = await repo.listar(prisma, { where, skip: (page - 1) * pageSize, take: pageSize });
      return { items: items.map(solicitudDTO), total, page, pageSize };
    },

    async obtener(id) {
      const s = await repo.porId(prisma, id);
      if (!s) throw notFound('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada');
      return solicitudDTO(s);
    },

    // ---------- HU11: aprobar o rechazar ----------
    /** Aprobar crea el usuario FUNCIONARIO, genera la contraseña temporal (HU02) y la envía por correo. Todo o nada. */
    async aprobar(actor, id, ip) {
      const s = await repo.porId(prisma, id);
      if (!s) throw notFound('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada');
      if (s.estado !== 'PENDIENTE_REVISION') {
        throw conflict('SOLICITUD_NO_PENDIENTE', 'Solo se pueden resolver solicitudes pendientes de revisión');
      }
      if (await repo.usuarioPorIdentificacionOCorreo(prisma, s.identificacion, s.correo)) {
        throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso registrado con la identificación o el correo de la solicitud');
      }
      const rol = await repo.rolPorNombre(prisma, ROL_FUNCIONARIO);
      const cred = await generarCredencialTemporal(cfg);
      try {
        await prisma.$transaction(async (tx) => {
          const usuario = await repo.crearUsuarioFuncionario(tx, {
            identificacion: s.identificacion,
            nombres: s.nombres,
            apellidos: s.apellidos,
            correo: s.correo,
            rolId: rol.id,
            fuerzaPublicaId: s.fuerzaPublicaId,
            rangoId: s.rangoId,
            idFuerza: s.idFuerza,
            passwordHash: cred.passwordHash,
            debeCambiarPassword: true,
            passwordExpiraEn: cred.passwordExpiraEn,
          });
          const r = await repo.resolver(tx, id, { estado: 'APROBADA', usuarioId: usuario.id, resueltaPor: actor.id, resueltaEn: new Date() });
          if (r.count === 0) throw conflict('SOLICITUD_NO_PENDIENTE', 'La solicitud ya fue resuelta por otra persona');
          await audit.registrar({ usuarioId: actor.id, accion: 'SOLICITUD_APROBADA', entidad: 'solicitud', entidadId: id, ip, detalle: { usuarioCreado: usuario.id } }, tx);
          // Si el correo falla, la transacción se revierte: la solicitud sigue pendiente y no queda una cuenta sin credenciales.
          try {
            await mail.enviarCredenciales({ para: s.correo, nombres: s.nombres, identificacion: s.identificacion, passwordTemporal: cred.passwordTemporal, expiraEn: cred.passwordExpiraEn });
          } catch {
            throw new AppError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo con las credenciales. La solicitud sigue pendiente');
          }
        });
      } catch (e) {
        if (e?.code === 'P2002') throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso con esa identificación, correo o ID Fuerza');
        throw e;
      }
      return solicitudDTO(await repo.porId(prisma, id));
    },

    async rechazar(actor, id, { motivo }, ip) {
      const s = await repo.porId(prisma, id);
      if (!s) throw notFound('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada');
      if (s.estado !== 'PENDIENTE_REVISION') {
        throw conflict('SOLICITUD_NO_PENDIENTE', 'Solo se pueden resolver solicitudes pendientes de revisión');
      }
      await prisma.$transaction(async (tx) => {
        const r = await repo.resolver(tx, id, { estado: 'RECHAZADA', resueltaPor: actor.id, resueltaEn: new Date(), motivo });
        if (r.count === 0) throw conflict('SOLICITUD_NO_PENDIENTE', 'La solicitud ya fue resuelta por otra persona');
        await audit.registrar({ usuarioId: actor.id, accion: 'SOLICITUD_RECHAZADA', entidad: 'solicitud', entidadId: id, ip }, tx);
      });
      return solicitudDTO(await repo.porId(prisma, id));
    },
  };
}