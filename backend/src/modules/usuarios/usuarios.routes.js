import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import { crearUsuarioSchema, editarUsuarioSchema, estadoUsuarioSchema, idUsuarioSchema, listarUsuariosSchema, rolUsuarioSchema } from './usuarios.schemas.js';

export function createUsuariosRouter({ service }) {
  const router = Router();

  router.get('/', authorize('usuarios:leer'), validate(listarUsuariosSchema), async (req, res) => {
    res.json(await service.listar(req.validQuery));
  });
  router.get('/:id', authorize('usuarios:leer'), validate(idUsuarioSchema), async (req, res) => {
    res.json({ usuario: await service.obtener(req.params.id) });
  });
  router.post('/', authorize('usuarios:crear'), validate(crearUsuarioSchema), async (req, res) => {
    res.status(201).json({ usuario: await service.crear(req.user, req.body, req.ip) });
  });
  router.patch('/:id', authorize('usuarios:editar'), validate(editarUsuarioSchema), async (req, res) => {
    res.json({ usuario: await service.editar(req.user, req.params.id, req.body, req.ip) });
  });
  router.patch('/:id/estado', authorize('usuarios:editar'), validate(estadoUsuarioSchema), async (req, res) => {
    res.json({ usuario: await service.cambiarEstado(req.user, req.params.id, req.body.estado, req.ip) });
  });
  router.patch('/:id/rol', authorize('usuarios:editar'), validate(rolUsuarioSchema), async (req, res) => {
    res.json({ usuario: await service.cambiarRol(req.user, req.params.id, req.body.rolId, req.ip) });
  });
  router.post('/:id/restablecer-password', authorize('usuarios:editar'), validate(idUsuarioSchema), async (req, res) => {
    await service.restablecerPassword(req.user, req.params.id, req.ip);
    res.status(204).end();
  });
  return router;
}
