import { forbidden } from '../common/errors.js';

export const ROL_ADMINISTRADOR = 'ADMINISTRADOR';

export async function permisosDeRol(db, rolId) {
  const filas = await db.rolPermiso.findMany({ where: { rolId }, include: { permiso: true } });
  return new Set(filas.map((f) => f.permiso.codigo));
}

/**
 * Impide la escalada de privilegios: un usuario solo puede asignar o administrar roles cuyos
 * permisos posee en su totalidad. Se aplica siempre en el servidor.
 */
export async function exigirPuedeAdministrarRol(db, actor, rolId) {
  const permisosRol = await permisosDeRol(db, rolId);
  for (const codigo of permisosRol) {
    if (!actor.permisos.has(codigo)) {
      throw forbidden('ESCALADA_PRIVILEGIOS', 'No puede administrar un rol con privilegios superiores a los suyos');
    }
  }
}
