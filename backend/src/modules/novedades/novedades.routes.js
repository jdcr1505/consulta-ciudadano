import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import { cambiarEstadoSchema, crearNovedadSchema, idNovedadSchema, listarNovedadesSchema } from './novedades.schemas.js';

export function createNovedadesRouter({ service }) {
  const router = Router();

  // Funcionario: HU08 (registrar) y HU09 (consultar el estado de las suyas). "/mias" va antes de "/:id".
  router.post('/', authorize('novedades:crear'), validate(crearNovedadSchema), async (req, res) => {
    res.status(201).json({ novedad: await service.crear(req.user, req.body, req.ip) });
  });
  router.get('/mias', authorize('novedades:leer_propias'), validate(listarNovedadesSchema), async (req, res) => {
    res.json(await service.listarMias(req.user, req.validQuery));
  });
  router.get('/mias/:id', authorize('novedades:leer_propias'), validate(idNovedadSchema), async (req, res) => {
    res.json({ novedad: await service.obtenerMia(req.user, req.params.id) });
  });

  // Administrador: HU15 (consultar y gestionar todas).
  router.get('/', authorize('novedades:gestionar'), validate(listarNovedadesSchema), async (req, res) => {
    res.json(await service.listar(req.validQuery));
  });
  router.get('/:id', authorize('novedades:gestionar'), validate(idNovedadSchema), async (req, res) => {
    res.json({ novedad: await service.obtener(req.params.id) });
  });
  router.patch('/:id/estado', authorize('novedades:gestionar'), validate(cambiarEstadoSchema), async (req, res) => {
    res.json({ novedad: await service.cambiarEstado(req.user, req.params.id, req.body, req.ip) });
  });
  return router;
}