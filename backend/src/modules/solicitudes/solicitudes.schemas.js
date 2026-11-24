import { z } from 'zod';
import { correoSchema, identificacionSchema, idParam, nombreSchema, paginacion } from '../../common/fields.js';

export const crearSolicitudSchema = {
  body: z.object({
    identificacion: identificacionSchema,
    nombres: nombreSchema('Los nombres'),
    apellidos: nombreSchema('Los apellidos'),
    fuerzaPublicaId: z.coerce.number({ error: 'Seleccione la fuerza pública' }).int().positive('Seleccione la fuerza pública'),
    rangoId: z.coerce.number({ error: 'Seleccione el rango' }).int().positive('Seleccione el rango'),
    idFuerza: z
      .string({ error: 'El ID Fuerza es obligatorio' })
      .trim()
      .min(3, 'El ID Fuerza debe tener al menos 3 caracteres')
      .max(30, 'El ID Fuerza admite máximo 30 caracteres')
      .regex(/^[A-Za-z0-9-]+$/, 'El ID Fuerza solo admite letras, números y guion'),
    correo: correoSchema,
  }),
};

export const listarSolicitudesSchema = {
  query: z.object({
    estado: z.enum(['VALIDADA', 'PENDIENTE_REVISION', 'APROBADA', 'RECHAZADA'], { error: 'Estado inválido' }).optional(),
    q: z.string().trim().max(60).optional(),
    ...paginacion,
  }),
};

export const idSolicitudSchema = { params: idParam };

export const rechazarSolicitudSchema = {
  params: idParam,
  body: z.object({
    motivo: z.string({ error: 'Indique el motivo del rechazo' }).trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(500, 'El motivo admite máximo 500 caracteres'),
  }),
};