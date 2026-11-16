import { z } from 'zod';

const sinEspacios = (s) => s.replace(/\s+/g, ' ').trim();

export const identificacionSchema = z
  .string({ error: 'La identificación es obligatoria' })
  .trim()
  .regex(/^[0-9]{6,10}$/, 'La identificación debe tener entre 6 y 10 dígitos numéricos');

export const nombreSchema = (etiqueta) =>
  z
    .string({ error: `${etiqueta} es obligatorio` })
    .transform(sinEspacios)
    .pipe(
      z
        .string()
        .min(2, `${etiqueta} debe tener al menos 2 caracteres`)
        .max(100, `${etiqueta} admite máximo 100 caracteres`)
        .regex(/^[\p{L}][\p{L}\s'.-]*$/u, `${etiqueta} contiene caracteres no válidos`),
    );

export const correoSchema = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .max(254, 'El correo es demasiado largo')
  .pipe(z.email('El correo no tiene un formato válido'));

export const idParam = z.object({ id: z.coerce.number().int().positive('Identificador inválido') });

export const paginacion = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
