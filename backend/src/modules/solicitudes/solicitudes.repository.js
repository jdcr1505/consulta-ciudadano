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
};
