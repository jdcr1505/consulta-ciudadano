import { badRequest, conflict, notFound } from '../../common/errors.js';
import { ciudadanosRepository as repo } from './ciudadanos.repository.js';

const aFecha = (s) => new Date(`${s}T00:00:00Z`);
const deFecha = (d) => d.toISOString().slice(0, 10);

export function ciudadanoDTO(c) {
  return {
    id: c.id,
    identificacion: c.identificacion,
    nombres: c.nombres,
    apellidos: c.apellidos,
    fechaNacimiento: deFecha(c.fechaNacimiento),
    lugarNacimiento: c.lugarNacimiento,
    fechaExpedicion: deFecha(c.fechaExpedicion),
    lugarExpedicion: c.lugarExpedicion,
    rh: c.rh,
    grupoSanguineo: c.grupoSanguineo,
    estaturaCm: c.estaturaCm,
    estadoJudicial: c.estadoJudicial,
    activo: c.activo,
  };
}

const aDatosBD = (d) => ({
  ...d,
  ...(d.fechaNacimiento && { fechaNacimiento: aFecha(d.fechaNacimiento) }),
  ...(d.fechaExpedicion && { fechaExpedicion: aFecha(d.fechaExpedicion) }),
});

/** HU14 — Administración de ciudadanos (Sistema de Registro). Sin borrado físico: se desactiva. */
export function createCiudadanosService({ prisma, audit }) {
  async function cargar(id) {
    const c = await repo.porId(prisma, id);
    if (!c) throw notFound('CIUDADANO_NO_ENCONTRADO', 'Ciudadano no encontrado');
    return c;
  }

  return {
    async listar({ q, identificacion, estadoJudicial, activo, page, pageSize }) {
      const where = {
        ...(identificacion && { identificacion: { startsWith: identificacion } }),
        ...(estadoJudicial && { estadoJudicial }),
        ...(activo !== undefined && { activo }),
        ...(q && {
          OR: [
            { identificacion: { startsWith: q } },
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
          ],
        }),
      };
      const [items, total] = await repo.listar(prisma, { where, skip: (page - 1) * pageSize, take: pageSize });
      return { items: items.map(ciudadanoDTO), total, page, pageSize };
    },

    async obtener(id) {
      return ciudadanoDTO(await cargar(id));
    },

    async crear(actor, datos, ip) {
      try {
        return ciudadanoDTO(
          await prisma.$transaction(async (tx) => {
            const c = await repo.crear(tx, { ...aDatosBD(datos), creadoPor: actor.id });
            await audit.registrar({ usuarioId: actor.id, accion: 'CIUDADANO_CREADO', entidad: 'ciudadano', entidadId: c.id, ip }, tx);
            return c;
          }),
        );
      } catch (e) {
        if (e?.code === 'P2002') throw conflict('CIUDADANO_DUPLICADO', 'Ya existe un ciudadano con esa identificación');
        throw e;
      }
    },

    async editar(actor, id, cambios, ip) {
      const actual = await cargar(id);
      // Coherencia de fechas considerando los valores ya almacenados cuando solo llega uno de los dos.
      const nac = cambios.fechaNacimiento ?? deFecha(actual.fechaNacimiento);
      const exp = cambios.fechaExpedicion ?? deFecha(actual.fechaExpedicion);
      if (exp <= nac) {
        throw badRequest('VALIDACION', 'Hay datos inválidos o incompletos', [
          { campo: 'fechaExpedicion', mensaje: 'La fecha de expedición debe ser posterior a la de nacimiento' },
        ]);
      }
      return ciudadanoDTO(
        await prisma.$transaction(async (tx) => {
          const c = await repo.actualizar(tx, id, aDatosBD(cambios));
          await audit.registrar(
            { usuarioId: actor.id, accion: 'CIUDADANO_EDITADO', entidad: 'ciudadano', entidadId: id, ip, detalle: { campos: Object.keys(cambios) } },
            tx,
          );
          return c;
        }),
      );
    },

    async cambiarActivo(actor, id, activo, ip) {
      await cargar(id);
      return ciudadanoDTO(
        await prisma.$transaction(async (tx) => {
          const c = await repo.actualizar(tx, id, { activo });
          await audit.registrar({ usuarioId: actor.id, accion: activo ? 'CIUDADANO_ACTIVADO' : 'CIUDADANO_DESACTIVADO', entidad: 'ciudadano', entidadId: id, ip }, tx);
          return c;
        }),
      );
    },
  };
}
