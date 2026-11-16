// Errores de aplicación con código estable para los clientes web y móvil.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (code, msg, details) => new AppError(400, code, msg, details);
export const unauthorized = (code = 'NO_AUTENTICADO', msg = 'Debe iniciar sesión') => new AppError(401, code, msg);
export const forbidden = (code = 'SIN_PERMISO', msg = 'No tiene permiso para esta operación') => new AppError(403, code, msg);
export const notFound = (code = 'NO_ENCONTRADO', msg = 'Recurso no encontrado') => new AppError(404, code, msg);
export const conflict = (code, msg, details) => new AppError(409, code, msg, details);

export function notFoundHandler(_req, _res, next) {
  next(notFound('RUTA_NO_ENCONTRADA', 'Ruta no encontrada'));
}

// Manejo centralizado: nunca filtra trazas ni detalles internos al cliente.
export function errorHandler(logger = console) {
  // eslint-disable-next-line no-unused-vars
  return (err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'El cuerpo de la petición no es JSON válido' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'CUERPO_DEMASIADO_GRANDE', message: 'Petición demasiado grande' } });
    }
    logger.error('Error no controlado:', err?.name, err?.message);
    return res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error interno' } });
  };
}
