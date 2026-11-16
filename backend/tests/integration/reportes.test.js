import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';

let ctx; let admin; let func;
const prev = (qs = '', t = admin) => ctx.api().get(`/api/v1/reportes/ciudadanos/vista-previa${qs}`).set(auth(t));

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  func = await tokenFuncionario(ctx);
});

describe('[HU16] selección de la información del reporte', () => {
  it('por defecto lista todos los ciudadanos activos con solo identificación, nombres y apellidos', async () => {
    const r = await prev();
    expect(r.status).toBe(200);
    expect(r.body.criterios).toEqual({ estado: 'TODOS', columnas: [] });
    expect(r.body.resumen).toEqual({ total: 8, requeridos: 3, noRequeridos: 5 });
    expect(r.body.total).toBe(8);
    expect(Object.keys(r.body.items[0]).sort()).toEqual(['apellidos', 'identificacion', 'nombres']);
  });
  it.each([['REQUERIDO', 3], ['NO_REQUERIDO', 5]])('filtra por estado %s', async (estado, n) => {
    const r = await prev(`?estado=${estado}&columnas=resultado`);
    expect(r.body.total).toBe(n);
    expect(r.body.items.every((i) => i.resultado === estado)).toBe(true);
  });
  it('columnas opcionales: resultado y última consulta (null si nunca fue consultado)', async () => {
    let r = await prev('?estado=REQUERIDO&columnas=resultado,ultimaConsulta');
    expect(r.body.items.every((i) => i.ultimaConsulta === null)).toBe(true);
    await ctx.api().post('/api/v1/consultas').set(auth(func)).send({ identificacion: '79123456' });
    r = await prev('?estado=REQUERIDO&columnas=resultado,ultimaConsulta');
    const consultado = r.body.items.find((i) => i.identificacion === '79123456');
    expect(new Date(consultado.ultimaConsulta).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(r.body.items.filter((i) => i.ultimaConsulta === null)).toHaveLength(2);
  });
  it('excluye a los ciudadanos desactivados', async () => {
    await ctx.prisma.ciudadano.update({ where: { identificacion: '79123456' }, data: { activo: false } });
    const r = await prev('?estado=REQUERIDO');
    expect(r.body.total).toBe(2);
    expect(r.body.items.map((i) => i.identificacion)).not.toContain('79123456');
    expect(r.body.resumen.total).toBe(7);
    await ctx.prisma.ciudadano.update({ where: { identificacion: '79123456' }, data: { activo: true } });
  });
  it('pagina los resultados', async () => {
    const r = await prev('?pageSize=3&page=3');
    expect(r.body.items).toHaveLength(2);
    expect(r.body.total).toBe(8);
  });
  it('valida estado y columnas', async () => {
    expect((await prev('?estado=OTRO')).status).toBe(400);
    expect((await prev('?columnas=fechaNacimiento')).status).toBe(400);
    expect((await prev('?pageSize=1000')).status).toBe(400);
  });
  it('control de acceso: sin sesión 401, funcionario 403', async () => {
    expect((await ctx.api().get('/api/v1/reportes/ciudadanos/vista-previa')).status).toBe(401);
    expect((await prev('', func)).status).toBe(403);
  });
  it('registra en auditoría cada vista previa', async () => {
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'REPORTE_VISTA_PREVIA' } })).toBeGreaterThan(3);
  });
});

describe('resumen de inicio por permisos', () => {
  it('el administrador ve ciudadanos, usuarios y consultas del día', async () => {
    const r = await ctx.api().get('/api/v1/resumen').set(auth(admin));
    expect(r.body.ciudadanos).toEqual({ total: 8, requeridos: 3, noRequeridos: 5 });
    expect(r.body.usuarios.activos).toBe(2);
    expect(r.body.consultasHoy.total).toBeGreaterThanOrEqual(1);
  });
  it('el funcionario no recibe ningún indicador', async () => {
    const r = await ctx.api().get('/api/v1/resumen').set(auth(func));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({});
  });
});
