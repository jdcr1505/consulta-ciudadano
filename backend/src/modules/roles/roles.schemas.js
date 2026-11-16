import { z } from 'zod';
import { idParam } from '../../common/fields.js';

const nombre = z
  .string({ error: 'El nombre del rol es obligatorio' })
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(40, 'El nombre admite máximo 40 caracteres')
  .regex(/^[\p{L}0-9 _-]+$/u, 'El nombre solo admite letras, números, espacios, guion y guion bajo');
const descripcion = z.string().trim().max(200, 'La descripción admite máximo 200 caracteres');
const permisoIds = z.array(z.coerce.number().int().positive()).max(200);

export const crearRolSchema = { body: z.object({ nombre, descripcion: descripcion.nullish(), permisoIds: permisoIds.default([]) }) };
export const editarRolSchema = {
  params: idParam,
  body: z.object({ nombre: nombre.optional(), descripcion: descripcion.nullable().optional() }).refine((o) => Object.keys(o).length > 0, 'Indique al menos un campo a modificar'),
};
export const permisosRolSchema = { params: idParam, body: z.object({ permisoIds }) };
export const idRolSchema = { params: idParam };
