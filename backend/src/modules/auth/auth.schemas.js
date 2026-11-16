import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    identificacion: z.string({ error: 'La identificación es obligatoria' }).trim().min(1, 'La identificación es obligatoria').max(30),
    password: z.string({ error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(128),
  }),
};

export const cambiarPasswordSchema = {
  body: z.object({
    passwordActual: z.string({ error: 'La contraseña actual es obligatoria' }).min(1, 'La contraseña actual es obligatoria').max(128),
    passwordNueva: z.string({ error: 'La contraseña nueva es obligatoria' }).min(1, 'La contraseña nueva es obligatoria').max(128),
  }),
};
