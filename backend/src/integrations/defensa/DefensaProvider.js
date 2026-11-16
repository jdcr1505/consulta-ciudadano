/**
 * Contrato del proveedor de validación del Departamento de Defensa.
 *
 * validar({ identificacion, nombres, apellidos, fuerza, rango, idFuerza })
 *   -> 'VALIDADO' | 'NO_ENCONTRADO' | 'DATOS_NO_COINCIDEN'
 *   lanza ServicioNoDisponibleError si el servicio no responde.
 *
 * SUSTITUCIÓN POR UNA INTEGRACIÓN REAL: implemente esta misma interfaz (p. ej. un cliente HTTP/SOAP
 * autorizado, con sus credenciales en variables de entorno) y regístrela en src/app.js en lugar de
 * SimDefensaProvider. Hoy NO existe conexión real con Defensa.
 */
export class ServicioNoDisponibleError extends Error {
  constructor(msg = 'Servicio de validación no disponible') {
    super(msg);
    this.name = 'ServicioNoDisponibleError';
  }
}
