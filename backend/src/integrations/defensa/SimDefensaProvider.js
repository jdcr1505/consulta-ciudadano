import { ServicioNoDisponibleError } from './DefensaProvider.js';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Identificación reservada que simula una caída del servicio (solo pruebas y demostraciones). */
export const IDENTIFICACION_SIMULA_CAIDA = '9999999999';

/**
 * SIMULACIÓN (modo desarrollo/académico): consulta la tabla local `sim_defensa` con datos FICTICIOS.
 * No representa ni se conecta a ninguna base de datos oficial.
 */
export class SimDefensaProvider {
  constructor(prisma) {
    this.prisma = prisma;
    this.simulado = true;
  }

  async validar({ identificacion, nombres, apellidos, fuerza, rango, idFuerza }) {
    if (identificacion === IDENTIFICACION_SIMULA_CAIDA) throw new ServicioNoDisponibleError();
    const reg = await this.prisma.simDefensa.findUnique({ where: { identificacion } });
    if (!reg) return 'NO_ENCONTRADO';
    const coincide =
      norm(reg.nombres) === norm(nombres) &&
      norm(reg.apellidos) === norm(apellidos) &&
      norm(reg.fuerza) === norm(fuerza) &&
      norm(reg.rango) === norm(rango) &&
      norm(reg.idFuerza) === norm(idFuerza);
    return coincide ? 'VALIDADO' : 'DATOS_NO_COINCIDEN';
  }
}
