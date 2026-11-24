import { z } from 'zod';
import { idParam, paginacion } from '../../common/fields.js';

const ESTADOS = ['REGISTRADA', 'EN_REVISION', 'ATENDIDA', 'DESCARTADA'];

export const crearNovedadSchema = {
  body: z.object({
    identificacion: z.union([z.string(), z.number()], { error: 'La identificación es obligatoria' }).transform(String),
    descripcion: z
      .string({ error: 'La descripción es obligatoria' })
      .trim()
      .min(10, 'Describa la novedad con al menos 10 caracteres')
      .max(1000, 'La descripción admite máximo 1000 caracteres'),
  }),
};

export const listarNovedadesSchema = {
  query: z.object({
    estado: z.enum(ESTADOS, { error: 'Estado inválido' }).optional(),
    q: z.string().trim().max(60).optional(),
    ...paginacion,
  }),
};

export const cambiarEstadoSchema = {
  params: idParam,
  body: z.object({
    estado: z.enum(['EN_REVISION', 'ATENDIDA', 'DESCARTADA'], { error: 'El nuevo estado debe ser EN_REVISION, ATENDIDA o DESCARTADA' }),
    comentario: z.string().trim().max(500, 'El comentario admite máximo 500 caracteres').optional(),
  }),
};

export const idNovedadSchema = { params: idParam };