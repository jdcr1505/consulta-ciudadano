const CIUDADANO = { select: { identificacion: true, nombres: true, apellidos: true } };
const USUARIO = { select: { id: true, identificacion: true, nombres: true, apellidos: true } };

export const novedadesRepository = {
  CIUDADANO,
  USUARIO,
  ciudadanoPorIdentificaciones: (db, identificaciones) =>
    db.ciudadano.findMany({ where: { identificacion: { in: identificaciones } }, orderBy: { id: 'asc' } }),
  crear: (db, data) => db.novedad.create({ data }),
  historialCrear: (db, data) => db.novedadHistorial.create({ data }),
  listar: (db, { where, skip, take, incluirRegistrador }) =>
    Promise.all([
      db.novedad.findMany({
        where,
        orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: { ciudadano: CIUDADANO, ...(incluirRegistrador && { registrador: USUARIO }) },
      }),
      db.novedad.count({ where }),
    ]),
  porId: (db, id, where = {}) =>
    db.novedad.findFirst({
      where: { id, ...where },
      include: {
        ciudadano: CIUDADANO,
        registrador: USUARIO,
        historial: { orderBy: [{ fecha: 'asc' }, { id: 'asc' }], include: { usuario: USUARIO } },
      },
    }),
  // Cambio de estado con "compare-and-set": solo si sigue en el estado que se leyó (evita carreras).
  cambiarEstado: (db, id, estadoActual, estadoNuevo) =>
    db.novedad.updateMany({ where: { id, estado: estadoActual }, data: { estado: estadoNuevo } }),
};