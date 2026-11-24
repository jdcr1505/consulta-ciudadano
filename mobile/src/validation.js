// Validaciones del lado del cliente (comodidad del usuario). El servidor SIEMPRE vuelve a validar.
export const reIdentificacion = /^[0-9]{6,10}$/;
export const reNombre = /^[\p{L}][\p{L}\s'.-]*$/u;
export const reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const reIdFuerza = /^[A-Za-z0-9-]+$/;

export function validarRegistro(f) {
  const e = {};
  if (!f.identificacion.trim()) e.identificacion = 'La identificación es obligatoria';
  else if (!reIdentificacion.test(f.identificacion.trim())) e.identificacion = 'Debe tener entre 6 y 10 dígitos numéricos';
  for (const [k, et] of [['nombres', 'Los nombres'], ['apellidos', 'Los apellidos']]) {
    const v = f[k].replace(/\s+/g, ' ').trim();
    if (!v) e[k] = `${et} son obligatorios`;
    else if (v.length < 2 || !reNombre.test(v)) e[k] = `${et} contienen caracteres no válidos`;
  }
  if (!f.fuerzaPublicaId) e.fuerzaPublicaId = 'Seleccione la fuerza pública';
  if (!f.rangoId) e.rangoId = 'Seleccione el rango';
  if (!f.idFuerza.trim()) e.idFuerza = 'El ID Fuerza es obligatorio';
  else if (f.idFuerza.trim().length < 3 || !reIdFuerza.test(f.idFuerza.trim())) e.idFuerza = 'Mínimo 3 caracteres: letras, números y guion';
  if (!f.correo.trim()) e.correo = 'El correo es obligatorio';
  else if (!reCorreo.test(f.correo.trim())) e.correo = 'El correo no tiene un formato válido';
  return e;
}

export function validarLogin(identificacion, password) {
  const e = {};
  if (!identificacion.trim()) e.identificacion = 'La identificación es obligatoria';
  if (!password) e.password = 'La contraseña es obligatoria';
  return e;
}

// Misma política que el servidor: 6 a 64 caracteres con mayúscula, minúscula y número.
export function cumplePolitica(p) {
  return typeof p === 'string' && p.length >= 6 && p.length <= 64 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
}

export function validarCambio(actual, nueva, confirmar) {
  const e = {};
  if (!actual) e.passwordActual = 'Ingrese su contraseña actual';
  if (!nueva) e.passwordNueva = 'Ingrese la contraseña nueva';
  else if (!cumplePolitica(nueva)) e.passwordNueva = 'Debe tener 6 a 64 caracteres, con mayúscula, minúscula y número';
  else if (nueva !== confirmar) e.confirmar = 'La confirmación no coincide';
  return e;
}

/** Número de cédula escrito a mano: solo dígitos, sin ceros de relleno, 6 a 10 dígitos. */
export function validarNumeroCedula(texto) {
  const n = String(texto ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return /^\d{6,10}$/.test(n) ? { numero: n } : { error: 'Ingrese entre 6 y 10 dígitos numéricos' };
}

/** Validación cliente para HU08 (registro de novedad): identificación válida + descripción de 10 a 1000 caracteres. */
export function validarNovedad({ identificacion, descripcion }) {
  const e = {};
  const rId = validarNumeroCedula(identificacion);
  if (rId.error) e.identificacion = 'La identificación debe tener entre 6 y 10 dígitos numéricos';
  const desc = String(descripcion ?? '').trim();
  if (!desc) e.descripcion = 'La descripción es obligatoria';
  else if (desc.length < 10) e.descripcion = 'Describa la novedad con al menos 10 caracteres';
  else if (desc.length > 1000) e.descripcion = 'La descripción admite máximo 1000 caracteres';
  return e;
}