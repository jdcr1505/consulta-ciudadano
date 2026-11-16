import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import {
  activoCiudadanoSchema, crearCiudadanoSchema, editarCiudadanoSchema, idCiudadanoSchema, listarCiudadanosSchema,
} from './ciudadanos.schemas.js';

export function createCiudadanosRouter({ service }) {
  const router = Router();
  router.get('/', authorize('ciudadanos:leer'), validate(listarCiudadanosSchema), async (req, res) => res.json(await service.listar(req.validQuery)));
  router.get('/:id', authorize('ciudadanos:leer'), validate(idCiudadanoSchema), async (req, res) => {
    res.json({ ciudadano: await service.obtener(req.params.id) });
  });
  router.post('/', authorize('ciudadanos:crear'), validate(crearCiudadanoSchema), async (req, res) => {
    res.status(201).json({ ciudadano: await service.crear(req.user, req.body, req.ip) });
  });
  router.patch('/:id', authorize('ciudadanos:editar'), validate(editarCiudadanoSchema), async (req, res) => {
    res.json({ ciudadano: await service.editar(req.user, req.params.id, req.body, req.ip) });
  });
  router.patch('/:id/activo', authorize('ciudadanos:editar'), validate(activoCiudadanoSchema), async (req, res) => {
    res.json({ ciudadano: await service.cambiarActivo(req.user, req.params.id, req.body.activo, req.ip) });
  });
  return router;
}
