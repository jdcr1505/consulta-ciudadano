import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import { crearRolSchema, editarRolSchema, idRolSchema, permisosRolSchema } from './roles.schemas.js';

export function createRolesRouter({ service }) {
  const router = Router();

  router.get('/', authorize('roles:leer', 'usuarios:leer'), async (_req, res) => res.json(await service.listar()));
  router.get('/permisos', authorize('roles:leer'), async (_req, res) => res.json(await service.catalogoPermisos()));
  router.get('/:id', authorize('roles:leer'), validate(idRolSchema), async (req, res) => res.json(await service.obtener(req.params.id)));
  router.post('/', authorize('roles:crear'), validate(crearRolSchema), async (req, res) => {
    res.status(201).json(await service.crear(req.user, req.body, req.ip));
  });
  router.patch('/:id', authorize('roles:editar'), validate(editarRolSchema), async (req, res) => {
    res.json(await service.editar(req.user, req.params.id, req.body, req.ip));
  });
  router.put('/:id/permisos', authorize('roles:editar'), validate(permisosRolSchema), async (req, res) => {
    res.json(await service.asignarPermisos(req.user, req.params.id, req.body.permisoIds, req.ip));
  });
  router.delete('/:id', authorize('roles:eliminar'), validate(idRolSchema), async (req, res) => {
    await service.eliminar(req.user, req.params.id, req.ip);
    res.status(204).end();
  });
  return router;
}
