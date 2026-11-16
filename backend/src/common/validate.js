import { badRequest } from './errors.js';

// Valida body / query / params con Zod. body y params se reemplazan por los valores normalizados;
// la query validada queda en req.validQuery (req.query es de solo lectura en Express 5).
export function validate(schemas) {
  return (req, _res, next) => {
    const details = [];
    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({ campo: issue.path.join('.') || part, mensaje: issue.message });
        }
      } else if (part === 'query') {
        req.validQuery = result.data;
      } else {
        Object.defineProperty(req, part, { value: result.data, configurable: true, writable: true });
      }
    }
    if (details.length) return next(badRequest('VALIDACION', 'Hay datos inválidos o incompletos', details));
    next();
  };
}
