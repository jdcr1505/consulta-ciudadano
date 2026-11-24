import { badRequest, conflict, notFound } from '../../common/errors.js';
import { normalizarIdentificacion, variantesConCeros } from '../consultas/consultas.service.js';
import { novedadesRepository as repo } from './novedades.repository.js';

/** Transiciones válidas del estado de una novedad (HU15). ATENDIDA y DESCARTADA son finales. */
export const TRANSICIONES = {
  REGISTRADA: ['EN_REVISION', 'DESCARTADA'],
  EN_REVISION: ['ATENDIDA', 'DESCARTADA'],
  ATENDIDA: [],
  DESCARTADA: [],
};

const ciudadanoDTO = (c) => ({ identificacion: c.identificacion, nombres: c.nombres, apellidos: c.apellidos });
const personaDTO = (u) => ({ id: u.id, identificacion: u.identificacion, nombres: u.nombres, apellidos: u.apellidos });

function itemDTO(n, { admin = false } = {}) {
  return {
    id: n.id,
    estado: n.estado,
    descripcion: n.descripcion,
    ciudadano: ciudadanoDTO(n.ciudadano),
    creadaEn: n.creadaEn,
    actualizadaEn: n.actualizadaEn,
    ...(admin && n.registrador && { registradaPor: personaDTO(n.registrador) }),
  };
}

// El funcionario ve el historial del estado (qué pasó y cuándo) sin los datos de quién lo gestionó.
function detalleDTO(n, { admin = false } = {}) {
  return {
    ...itemDTO(n, { admin }),
    siguientes: TRANSICIONES[n.estado],
    historial: n.historial.map((h) => ({
      estadoAnterior: h.estadoAnterior,
      estadoNuevo: h.estadoNuevo,
      comentario: h.comentario,
      fecha: h.fecha,
      ...(admin && { por: personaDTO(h.usuario) }),
    })),
  };
}

/** HU08 registrar, HU09 consultar el estado (funcionario) y HU15 consultar y gestionar (administrador). */
export function createNovedadesService({ prisma, audit }) {
  const filtroTexto = (q) =>
    q && {
      OR: [
        { descripcion: { contains: q, mode: 'insensitive' } },
        { ciudadano: { identificacion: { startsWith: q } } },
        { ciudadano: { nombres: { contains: q, mode: 'insensitive' } } },
        { ciudadano: { apellidos: { contains: q, mode: 'insensitive' } } },
      ],
    };

  return {
    // HU08
    async crear(usuario, { identificacion, descripcion }, ip) {
      const n = normalizarIdentificacion(identificacion);
      if (!n) throw badRequest('IDENTIFICACION_INVALIDA', 'La identificación debe tener entre 6 y 10 dígitos numéricos');
      const candidatos = await repo.ciudadanoPorIdentificaciones(prisma, variantesConCeros(n));
      const ciudadano = candidatos.find((c) => c.identificacion === n) ?? candidatos[0];
      if (!ciudadano) throw notFound('CIUDADANO_NO_ENCONTRADO', 'No se puede registrar una novedad: la identificación no figura en el sistema');

      const id = await prisma.$transaction(async (tx) => {
        const nov = await repo.crear(tx, { ciudadanoId: ciudadano.id, registradaPor: usuario.id, descripcion });
        await repo.historialCrear(tx, { novedadId: nov.id, estadoAnterior: null, estadoNuevo: 'REGISTRADA', cambiadoPor: usuario.id });
        await audit.registrar({ usuarioId: usuario.id, accion: 'NOVEDAD_REGISTRADA', entidad: 'novedad', entidadId: nov.id, ip }, tx);
        return nov.id;
      });
      return detalleDTO(await repo.porId(prisma, id));
    },

    // HU09
    async listarMias(usuario, { estado, q, page, pageSize }) {
      const where = { registradaPor: usuario.id, ...(estado && { estado }), ...filtroTexto(q) };
      const [items, total] = await repo.listar(prisma, { where, skip: (page - 1) * pageSize, take: pageSize });
      return { items: items.map((n) => itemDTO(n)), total, page, pageSize };
    },

    async obtenerMia(usuario, id) {
      const n = await repo.porId(prisma, id, { registradaPor: usuario.id }); // una novedad ajena responde 404
      if (!n) throw notFound('NOVEDAD_NO_ENCONTRADA', 'Novedad no encontrada');
      return detalleDTO(n);
    },

    // HU15
    async listar({ estado, q, page, pageSize }) {
      const where = { ...(estado && { estado }), ...filtroTexto(q) };
      const [items, total] = await repo.listar(prisma, { where, skip: (page - 1) * pageSize, take: pageSize, incluirRegistrador: true });
      return { items: items.map((n) => itemDTO(n, { admin: true })), total, page, pageSize };
    },

    async obtener(id) {
      const n = await repo.porId(prisma, id);
      if (!n) throw notFound('NOVEDAD_NO_ENCONTRADA', 'Novedad no encontrada');
      return detalleDTO(n, { admin: true });
    },

    async cambiarEstado(actor, id, { estado, comentario }, ip) {
      const actual = await repo.porId(prisma, id);
      if (!actual) throw notFound('NOVEDAD_NO_ENCONTRADA', 'Novedad no encontrada');
      const permitidas = TRANSICIONES[actual.estado];
      if (!permitidas.includes(estado)) {
        throw conflict('TRANSICION_INVALIDA', `No se puede pasar de ${actual.estado} a ${estado}`, { permitidas });
      }
      if (estado === 'DESCARTADA' && !comentario) {
        throw badRequest('COMENTARIO_REQUERIDO', 'Indique el motivo para descartar la novedad');
      }
      await prisma.$transaction(async (tx) => {
        const r = await repo.cambiarEstado(tx, id, actual.estado, estado);
        if (r.count === 0) throw conflict('TRANSICION_INVALIDA', 'La novedad cambió de estado mientras la editaba. Recargue e intente de nuevo');
        await repo.historialCrear(tx, { novedadId: id, estadoAnterior: actual.estado, estadoNuevo: estado, cambiadoPor: actor.id, comentario: comentario ?? null });
        await audit.registrar({ usuarioId: actor.id, accion: 'NOVEDAD_ESTADO', entidad: 'novedad', entidadId: id, ip, detalle: { de: actual.estado, a: estado } }, tx);
      });
      return detalleDTO(await repo.porId(prisma, id), { admin: true });
    },
  };
}