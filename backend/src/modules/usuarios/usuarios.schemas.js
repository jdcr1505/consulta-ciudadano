import { z } from 'zod';
import { correoSchema, identificacionSchema, idParam, nombreSchema, paginacion } from '../../common/fields.js';

const idFuerza = z
  .string()
  .trim()
  .min(3, 'El ID Fuerza debe tener al menos 3 caracteres')
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, 'El ID Fuerza solo admite letras, números y guion');

export const listarUsuariosSchema = {
  query: z.object({
    q: z.string().trim().max(60).optional(),
    estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
    rolId: z.coerce.number().int().positive().optional(),
    ...paginacion,
  }),
};

export const crearUsuarioSchema = {
  body: z.object({
    identificacion: identificacionSchema,
    nombres: nombreSchema('Los nombres'),
    apellidos: nombreSchema('Los apellidos'),
    correo: correoSchema,
    rolId: z.coerce.number({ error: 'Seleccione el rol' }).int().positive('Seleccione el rol'),
    fuerzaPublicaId: z.coerce.number().int().positive().nullish(),
    rangoId: z.coerce.number().int().positive().nullish(),
    idFuerza: idFuerza.nullish(),
  }),
};

export const editarUsuarioSchema = {
  params: idParam,
  body: z
    .object({
      nombres: nombreSchema('Los nombres').optional(),
      apellidos: nombreSchema('Los apellidos').optional(),
      correo: correoSchema.optional(),
      fuerzaPublicaId: z.coerce.number().int().positive().nullable().optional(),
      rangoId: z.coerce.number().int().positive().nullable().optional(),
      idFuerza: idFuerza.nullable().optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'Indique al menos un campo a modificar'),
};

export const estadoUsuarioSchema = { params: idParam, body: z.object({ estado: z.enum(['ACTIVO', 'INACTIVO'], { error: 'Estado inválido' }) }) };
export const rolUsuarioSchema = { params: idParam, body: z.object({ rolId: z.coerce.number({ error: 'Seleccione el rol' }).int().positive() }) };
export const idUsuarioSchema = { params: idParam };
