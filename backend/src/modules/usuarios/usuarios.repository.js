const INCLUDE = { rol: true, fuerza: true, rango: true };

export const usuariosRepository = {
  INCLUDE,
  listar: (db, { where, skip, take }) =>
    Promise.all([
      db.usuario.findMany({ where, include: INCLUDE, orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }], skip, take }),
      db.usuario.count({ where }),
    ]),
  porId: (db, id) => db.usuario.findUnique({ where: { id }, include: INCLUDE }),
  rol: (db, id) => db.rol.findUnique({ where: { id } }),
  rango: (db, id, fuerzaPublicaId) => db.rango.findFirst({ where: { id, fuerzaPublicaId } }),
  crear: (db, data) => db.usuario.create({ data, include: INCLUDE }),
  actualizar: (db, id, data) => db.usuario.update({ where: { id }, data, include: INCLUDE }),
  administradoresActivosExcepto: (db, id, nombreRolAdmin) =>
    db.usuario.count({ where: { id: { not: id }, estado: 'ACTIVO', rol: { nombre: nombreRolAdmin } } }),
  revocarSesiones: (db, usuarioId) => db.sesion.updateMany({ where: { usuarioId }, data: { revocada: true } }),
};
