export const ciudadanosRepository = {
  listar: (db, { where, skip, take }) =>
    Promise.all([
      db.ciudadano.findMany({ where, orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }], skip, take }),
      db.ciudadano.count({ where }),
    ]),
  porId: (db, id) => db.ciudadano.findUnique({ where: { id } }),
  crear: (db, data) => db.ciudadano.create({ data }),
  actualizar: (db, id, data) => db.ciudadano.update({ where: { id }, data }),
};
