import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { ROL_ADMINISTRADOR } from '../../security/privilegios.js';
import { rolesRepository as repo } from './roles.repository.js';

const rolResumen = (r) => ({
  id: r.id,
  nombre: r.nombre,
  descripcion: r.descripcion,
  esBase: r.esBase,
  usuarios: r._count?.usuarios ?? 0,
  permisos: r._count?.permisos ?? r.permisos?.length ?? 0,
});

const rolDetalle = (r) => ({
  id: r.id,
  nombre: r.nombre,
  descripcion: r.descripcion,
  esBase: r.esBase,
  usuarios: r._count?.usuarios ?? 0,
  permisos: r.permisos.map((rp) => ({ id: rp.permiso.id, codigo: rp.permiso.codigo })).sort((a, b) => a.id - b.id),
});

/** HU13 — Gestión de roles y permisos (opciones × acciones) con control de escalada de privilegios. */
export function createRolesService({ prisma, audit }) {
  async function cargar(id) {
    const r = await repo.porId(prisma, id);
    if (!r) throw notFound('ROL_NO_ENCONTRADO', 'Rol no encontrado');
    return r;
  }
  const exigirNoProtegido = (rol) => {
    if (rol.nombre === ROL_ADMINISTRADOR) {
      throw forbidden('ROL_PROTEGIDO', 'Los permisos del rol Administrador no se pueden modificar para evitar bloqueos del sistema');
    }
  };

  return {
    async listar() {
      return { roles: (await repo.listar(prisma)).map(rolResumen) };
    },
    async obtener(id) {
      return { rol: rolDetalle(await cargar(id)) };
    },
    async catalogoPermisos() {
      const opciones = await repo.catalogoPermisos(prisma);
      return {
        opciones: opciones.map((o) => ({
          id: o.id,
          codigo: o.codigo,
          nombre: o.nombre,
          permisos: o.permisos.map((p) => ({ id: p.id, accion: p.accion, codigo: p.codigo })),
        })),
      };
    },

    async crear(actor, { nombre, descripcion, permisoIds }, ip) {
      if (await repo.porNombreInsensible(prisma, nombre)) throw conflict('ROL_DUPLICADO', 'Ya existe un rol con ese nombre');
      const permisos = await repo.permisosPorIds(prisma, permisoIds);
      if (permisos.length !== new Set(permisoIds).size) throw badRequest('PERMISO_NO_ENCONTRADO', 'Alguno de los permisos indicados no existe');
      const noPropios = permisos.filter((p) => !actor.permisos.has(p.codigo));
      if (noPropios.length) throw forbidden('ESCALADA_PRIVILEGIOS', 'No puede otorgar permisos que usted no posee');
      const id = await prisma.$transaction(async (tx) => {
        const rol = await repo.crear(tx, { nombre, descripcion: descripcion ?? null });
        await repo.reemplazarPermisos(tx, rol.id, [...new Set(permisoIds)]);
        await audit.registrar({ usuarioId: actor.id, accion: 'ROL_CREADO', entidad: 'rol', entidadId: rol.id, ip, detalle: { nombre } }, tx);
        return rol.id;
      });
      return { rol: rolDetalle(await cargar(id)) };
    },

    async editar(actor, id, cambios, ip) {
      const rol = await cargar(id);
      if (cambios.nombre && cambios.nombre !== rol.nombre) {
        if (rol.esBase) throw forbidden('ROL_BASE', 'Los roles base no se pueden renombrar');
        const otro = await repo.porNombreInsensible(prisma, cambios.nombre);
        if (otro && otro.id !== id) throw conflict('ROL_DUPLICADO', 'Ya existe un rol con ese nombre');
      }
      await prisma.$transaction(async (tx) => {
        await repo.actualizar(tx, id, cambios);
        await audit.registrar({ usuarioId: actor.id, accion: 'ROL_EDITADO', entidad: 'rol', entidadId: id, ip, detalle: { campos: Object.keys(cambios) } }, tx);
      });
      return { rol: rolDetalle(await cargar(id)) };
    },

    async asignarPermisos(actor, id, permisoIds, ip) {
      const rol = await cargar(id);
      exigirNoProtegido(rol);
      const ids = [...new Set(permisoIds)];
      const permisos = await repo.permisosPorIds(prisma, ids);
      if (permisos.length !== ids.length) throw badRequest('PERMISO_NO_ENCONTRADO', 'Alguno de los permisos indicados no existe');
      const actuales = new Set(rol.permisos.map((rp) => rp.permisoId));
      // Solo se pueden AGREGAR permisos que el propio actor posee.
      const nuevosNoPropios = permisos.filter((p) => !actuales.has(p.id) && !actor.permisos.has(p.codigo));
      if (nuevosNoPropios.length) throw forbidden('ESCALADA_PRIVILEGIOS', 'No puede otorgar permisos que usted no posee');
      await prisma.$transaction(async (tx) => {
        await repo.reemplazarPermisos(tx, id, ids);
        await audit.registrar({ usuarioId: actor.id, accion: 'ROL_PERMISOS', entidad: 'rol', entidadId: id, ip, detalle: { cantidad: ids.length } }, tx);
      });
      return { rol: rolDetalle(await cargar(id)) };
    },

    async eliminar(actor, id, ip) {
      const rol = await cargar(id);
      if (rol.esBase) throw forbidden('ROL_BASE', 'Los roles base no se pueden eliminar');
      if (rol._count.usuarios > 0) throw conflict('ROL_EN_USO', 'No se puede eliminar un rol con usuarios asignados');
      await prisma.$transaction(async (tx) => {
        await repo.eliminar(tx, id);
        await audit.registrar({ usuarioId: actor.id, accion: 'ROL_ELIMINADO', entidad: 'rol', entidadId: id, ip, detalle: { nombre: rol.nombre } }, tx);
      });
    },
  };
}
