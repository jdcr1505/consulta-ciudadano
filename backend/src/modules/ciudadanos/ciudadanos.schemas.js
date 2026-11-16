import { z } from 'zod';
import { identificacionSchema, idParam, nombreSchema, paginacion } from '../../common/fields.js';

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const fecha = (etiqueta) =>
  z
    .string({ error: `${etiqueta} es obligatoria` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${etiqueta} debe tener formato AAAA-MM-DD`)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, `${etiqueta} no es una fecha válida`)
    .refine((s) => s <= hoyBogota(), `${etiqueta} no puede ser futura`)
    .refine((s) => s >= '1900-01-01', `${etiqueta} no puede ser anterior a 1900`);

const lugar = (etiqueta) =>
  z
    .string({ error: `${etiqueta} es obligatorio` })
    .trim()
    .min(2, `${etiqueta} debe tener al menos 2 caracteres`)
    .max(100, `${etiqueta} admite máximo 100 caracteres`);

const campos = {
  nombres: nombreSchema('Los nombres'),
  apellidos: nombreSchema('Los apellidos'),
  fechaNacimiento: fecha('La fecha de nacimiento'),
  lugarNacimiento: lugar('El lugar de nacimiento'),
  fechaExpedicion: fecha('La fecha de expedición'),
  lugarExpedicion: lugar('El lugar de expedición'),
  rh: z.enum(['POSITIVO', 'NEGATIVO'], { error: 'RH debe ser POSITIVO o NEGATIVO' }),
  grupoSanguineo: z.enum(['A', 'B', 'AB', 'O'], { error: 'El grupo sanguíneo debe ser A, B, AB u O' }),
  estaturaCm: z.coerce
    .number({ error: 'La estatura es obligatoria' })
    .int('La estatura debe ser un número entero de centímetros')
    .min(50, 'La estatura mínima es 50 cm')
    .max(250, 'La estatura máxima es 250 cm'),
  estadoJudicial: z.enum(['REQUERIDO', 'NO_REQUERIDO'], { error: 'El estado debe ser REQUERIDO o NO_REQUERIDO' }),
};

const ordenFechas = (o, ctx) => {
  if (o.fechaNacimiento && o.fechaExpedicion && o.fechaExpedicion <= o.fechaNacimiento) {
    ctx.addIssue({ code: 'custom', path: ['fechaExpedicion'], message: 'La fecha de expedición debe ser posterior a la de nacimiento' });
  }
};

export const crearCiudadanoSchema = {
  body: z.object({ identificacion: identificacionSchema, ...campos, estadoJudicial: campos.estadoJudicial.default('NO_REQUERIDO') }).superRefine(ordenFechas),
};

// La identificación es inmutable: es la clave de negocio usada por consultas e historial.
export const editarCiudadanoSchema = {
  params: idParam,
  body: z
    .object({
      nombres: campos.nombres.optional(),
      apellidos: campos.apellidos.optional(),
      fechaNacimiento: campos.fechaNacimiento.optional(),
      lugarNacimiento: campos.lugarNacimiento.optional(),
      fechaExpedicion: campos.fechaExpedicion.optional(),
      lugarExpedicion: campos.lugarExpedicion.optional(),
      rh: campos.rh.optional(),
      grupoSanguineo: campos.grupoSanguineo.optional(),
      estaturaCm: campos.estaturaCm.optional(),
      estadoJudicial: campos.estadoJudicial.optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'Indique al menos un campo a modificar')
    .superRefine(ordenFechas),
};

export const activoCiudadanoSchema = { params: idParam, body: z.object({ activo: z.boolean({ error: 'Indique si el ciudadano está activo' }) }) };
export const idCiudadanoSchema = { params: idParam };

export const listarCiudadanosSchema = {
  query: z.object({
    q: z.string().trim().max(60).optional(),
    identificacion: z.string().trim().regex(/^[0-9]{1,10}$/, 'Identificación inválida').optional(),
    estadoJudicial: z.enum(['REQUERIDO', 'NO_REQUERIDO']).optional(),
    activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    ...paginacion,
  }),
};
