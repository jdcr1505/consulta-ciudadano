import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';

let ctx; let func; let admin;
const consultar = (body, t = func) => ctx.api().post('/api/v1/consultas').set(auth(t)).send(body);
const contar = (where = {}) => ctx.prisma.consulta.count({ where });

beforeAll(async () => {
  ctx = await crearContexto();
  func = await tokenFuncionario(ctx);
  admin = await tokenAdmin(ctx);
});

describe('[HU04][HU05][HU06] consulta del estado judicial', () => {
  it('ciudadano REQUERIDO: devuelve el resultado y solo los datos mínimos', async () => {
    const r = await consultar({ identificacion: '79123456', origen: 'ESCANER' });
    expect(r.status).toBe(200);
    expect(r.body.resultado).toBe('REQUERIDO');
    expect(r.body.ciudadano).toEqual({ identificacion: '79123456', nombres: 'Jorge Enrique', apellidos: 'Castaño Lara' });
    expect(JSON.stringify(r.body)).not.toMatch(/fechaNacimiento|estatura|rh|grupoSanguineo|lugar/i);
  });
  it('ciudadano NO REQUERIDO', async () => {
    const r = await consultar({ identificacion: '52000111' });
    expect(r.status).toBe(200);
    expect(r.body.resultado).toBe('NO_REQUERIDO');
  });
  it('HU06: cada consulta queda registrada con funcionario, ciudadano, resultado, origen y hora', async () => {
    const yo = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1050607080' } });
    const c = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '79123456' } });
    const fila = await ctx.prisma.consulta.findFirst({ where: { usuarioId: yo.id, ciudadanoId: c.id } });
    expect(fila).toMatchObject({ resultado: 'REQUERIDO', origen: 'ESCANER', identificacionConsultada: '79123456' });
    expect(fila.fechaHora.getTime()).toBeGreaterThan(Date.now() - 60_000);
    const aud = await ctx.prisma.auditoria.findFirst({ where: { accion: 'CONSULTA', usuarioId: yo.id } });
    expect(aud.detalle).toMatchObject({ resultado: 'REQUERIDO' });
  });
  it('quita los ceros de relleno del código de barras (0079123456 → 79123456)', async () => {
    const r = await consultar({ identificacion: '0079123456', origen: 'ESCANER' });
    expect(r.status).toBe(200);
    expect(r.body.ciudadano.identificacion).toBe('79123456');
  });
  it('encuentra identificaciones almacenadas con ceros a la izquierda (00123456) al escanear sin ellos', async () => {
    const r = await consultar({ identificacion: '123456' });
    expect(r.status).toBe(200);
    expect(r.body.ciudadano.identificacion).toBe('00123456');
  });
  it('acepta la identificación como número JSON', async () => {
    expect((await consultar({ identificacion: 52000111 })).status).toBe(200);
  });
});

describe('[HU04] errores diferenciados (nunca "No requerido" por error)', () => {
  it('ciudadano inexistente → 404 CIUDADANO_NO_ENCONTRADO, y se registra como NO_ENCONTRADO', async () => {
    const antes = await contar({ resultado: 'NO_ENCONTRADO' });
    const r = await consultar({ identificacion: '9000000009' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('CIUDADANO_NO_ENCONTRADO');
    expect(r.body.resultado).toBeUndefined();
    expect(await contar({ resultado: 'NO_ENCONTRADO' })).toBe(antes + 1);
    const fila = await ctx.prisma.consulta.findFirst({ where: { identificacionConsultada: '9000000009' } });
    expect(fila.ciudadanoId).toBeNull();
  });
  it('ciudadano desactivado no está disponible para consultas', async () => {
    await ctx.prisma.ciudadano.update({ where: { identificacion: '80987654' }, data: { activo: false } });
    const r = await consultar({ identificacion: '80987654' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('CIUDADANO_NO_ENCONTRADO');
    await ctx.prisma.ciudadano.update({ where: { identificacion: '80987654' }, data: { activo: true } });
  });
  it.each([['abc'], ['123'], ['12345678901'], ['12 34 56'], ['']])('identificación inválida "%s" → 400 IDENTIFICACION_INVALIDA sin registrar', async (valor) => {
    const antes = await contar();
    const r = await consultar({ identificacion: valor });
    expect(r.status).toBe(400);
    expect(['IDENTIFICACION_INVALIDA', 'VALIDACION']).toContain(r.body.error.code);
    expect(await contar()).toBe(antes);
  });
  it('identificación ausente u origen inválido → 400 VALIDACION', async () => {
    expect((await consultar({})).body.error.code).toBe('VALIDACION');
    expect((await consultar({ identificacion: '79123456', origen: 'XX' })).body.error.code).toBe('VALIDACION');
  });
  it('base de datos caída → 503 SERVICIO_NO_DISPONIBLE, sin resultado y sin registrar la consulta', async () => {
    const antes = await contar();
    ctx.simularCaidaBD(true);
    const r = await consultar({ identificacion: '52000111' });
    ctx.simularCaidaBD(false);
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('SERVICIO_NO_DISPONIBLE');
    expect(r.body.error.message).toMatch(/NO significa/);
    expect(r.body.resultado).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/NO_REQUERIDO"/);
    expect(await contar()).toBe(antes);
  });
});

describe('[HU04] acceso y límites', () => {
  it('sin sesión → 401', async () => {
    expect((await ctx.api().post('/api/v1/consultas').send({ identificacion: '79123456' })).status).toBe(401);
  });
  it('sin el permiso consultas:crear → 403 CONSULTA_NO_AUTORIZADA y queda auditado', async () => {
    const perm = await ctx.prisma.permiso.findUnique({ where: { codigo: 'consultas:crear' } });
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: rol.id, permisoId: perm.id } } });
    const antes = await contar();
    const r = await consultar({ identificacion: '79123456' });
    await ctx.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: perm.id } });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('CONSULTA_NO_AUTORIZADA');
    expect(await contar()).toBe(antes);
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'CONSULTA', resultado: 'NO_AUTORIZADO' } })).toBeGreaterThan(0);
  });
  it('el administrador también puede consultar (tiene el permiso)', async () => {
    expect((await consultar({ identificacion: '52000111' }, admin)).status).toBe(200);
  });
  it('limita las consultas por minuto de cada funcionario (429)', async () => {
    const c2 = await crearContexto({ env: { RATE_LIMIT_ENABLED: 'true' } });
    const t = await tokenFuncionario(c2);
    let ultimo;
    for (let i = 0; i < 61; i++) ultimo = await c2.api().post('/api/v1/consultas').set(auth(t)).send({ identificacion: 'abc' });
    expect(ultimo.status).toBe(429);
    expect(ultimo.body.error.code).toBe('DEMASIADAS_PETICIONES');
    await c2.prisma.$disconnect();
  });
});
