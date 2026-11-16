export const rolesRepository = {
  listar: (db) =>
    db.rol.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { usuarios: true, permisos: true } } } }),
  porId: (db, id) => db.rol.findUnique({ where: { id }, include: { permisos: { include: { permiso: true } }, _count: { select: { usuarios: true } } } }),
  porNombreInsensible: (db, nombre) => db.rol.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } }),
  crear: (db, data) => db.rol.create({ data }),
  actualizar: (db, id, data) => db.rol.update({ where: { id }, data }),
  eliminar: (db, id) => db.rol.delete({ where: { id } }),
  permisosPorIds: (db, ids) => db.permiso.findMany({ where: { id: { in: ids } } }),
  reemplazarPermisos: async (db, rolId, ids) => {
    await db.rolPermiso.deleteMany({ where: { rolId } });
    if (ids.length) await db.rolPermiso.createMany({ data: ids.map((permisoId) => ({ rolId, permisoId })) });
  },
  catalogoPermisos: (db) => db.opcion.findMany({ orderBy: { id: 'asc' }, include: { permisos: { orderBy: { id: 'asc' } } } }),
};
