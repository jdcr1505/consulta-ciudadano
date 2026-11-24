const INCLUDE = {
  fuerza: true,
  rango: true,
  resolvio: { select: { id: true, nombres: true, apellidos: true } },
};

export const solicitudesRepository = {
  fuerzaConRango: (db, fuerzaPublicaId, rangoId) =>
    db.rango.findFirst({ where: { id: rangoId, fuerzaPublicaId }, include: { fuerza: true } }),
  usuarioPorIdentificacionOCorreo: (db, identificacion, correo) =>
    db.usuario.findFirst({ where: { OR: [{ identificacion }, { correo }] }, select: { id: true } }),
  pendientePorIdentificacion: (db, identificacion) =>
    db.solicitud.findFirst({ where: { identificacion, estado: 'PENDIENTE_REVISION' }, select: { id: true } }),
  rolPorNombre: (db, nombre) => db.rol.findUnique({ where: { nombre } }),
  crearUsuarioFuncionario: (db, data) => db.usuario.create({ data }),
  crearSolicitud: (db, data) => db.solicitud.create({ data }),

  // Gestión (HU10, HU11)
  listar: (db, { where, skip, take }) =>
    Promise.all([
      db.solicitud.findMany({ where, orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }], skip, take, include: INCLUDE }),
      db.solicitud.count({ where }),
    ]),
  porId: (db, id) => db.solicitud.findUnique({ where: { id }, include: INCLUDE }),
  // "Compare-and-set": solo resuelve si sigue pendiente (evita que dos administradores la resuelvan a la vez).
  resolver: (db, id, data) => db.solicitud.updateMany({ where: { id, estado: 'PENDIENTE_REVISION' }, data }),
};