import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/security/password.js';
import { auth, crearContexto, login, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';

let ctx; let admin; let f1; let f2;
const post = (p, b, t) => ctx.api().post(`/api/v1${p}`).set(auth(t)).send(b);
const get = (p, t) => ctx.api().get(`/api/v1${p}`).set(auth(t));
const patch = (p, b, t) => ctx.api().patch(`/api/v1${p}`).set(auth(t)).send(b);
const DESC = 'El ciudadano fue visto cerca de la estación central';
const nueva = (t, extra = {}) => post('/novedades', { identificacion: '79123456', descripcion: DESC, ...extra }, t);

/** Segundo funcionario creado directo en BD (la fuente simulada de Defensa solo valida a unos pocos). */
async function funcionarioDirecto() {
  const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
  const fuerza = await ctx.prisma.fuerzaPublica.findUnique({ where: { nombre: 'Policía' } });
  const rango = await ctx.prisma.rango.findFirst({ where: { fuerzaPublicaId: fuerza.id } });
  await ctx.prisma.usuario.create({
    data: { identificacion: '7300000001', nombres: 'Pedro', apellidos: 'Segundo', correo: 'pedro2@example.test', rolId: rol.id, fuerzaPublicaId: fuerza.id, rangoId: rango.id, idFuerza: 'PN-73001', passwordHash: await hashPassword('Segundo1'), debeCambiarPassword: false },
  });
  return (await login(ctx, '7300000001', 'Segundo1')).body.accessToken;
}

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  f1 = await tokenFuncionario(ctx);
  f2 = await funcionarioDirecto();
});

describe('[HU08] registrar novedad', () => {
  it('registra la novedad con estado REGISTRADA y deja el primer movimiento en el historial', async () => {
    const r = await nueva(f1);
    expect(r.status).toBe(201);
    expect(r.body.novedad).toMatchObject({ estado: 'REGISTRADA', descripcion: DESC, ciudadano: { identificacion: '79123456', nombres: 'Jorge Enrique' }, siguientes: ['EN_REVISION', 'DESCARTADA'] });
    expect(r.body.novedad.historial).toHaveLength(1);
    expect(r.body.novedad.historial[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'REGISTRADA' });
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'NOVEDAD_REGISTRADA' } })).toBe(1);
  });
  it('acepta el número con ceros de relleno del código de barras', async () => {
    expect((await nueva(f1, { identificacion: '0079123456' })).body.novedad.ciudadano.identificacion).toBe('79123456');
  });
  it('un ciudadano que no figura en el sistema → 404 (no se puede registrar una novedad sobre él)', async () => {
    const r = await nueva(f1, { identificacion: '9000000009' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('CIUDADANO_NO_ENCONTRADO');
  });
  it.each([['abc'], ['123'], ['12345678901']])('identificación inválida "%s" → 400', async (valor) => {
    const r = await nueva(f1, { identificacion: valor });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('IDENTIFICACION_INVALIDA');
  });
  it('valida la descripción (obligatoria, mínimo 10 y máximo 1000 caracteres)', async () => {
    expect((await nueva(f1, { descripcion: 'corta' })).body.error.details[0].campo).toBe('descripcion');
    expect((await nueva(f1, { descripcion: 'x'.repeat(1001) })).status).toBe(400);
    expect((await post('/novedades', { identificacion: '79123456' }, f1)).status).toBe(400);
  });
  it('exige sesión y el permiso novedades:crear', async () => {
    expect((await ctx.api().post('/api/v1/novedades').send({})).status).toBe(401);
    const perm = await ctx.prisma.permiso.findUnique({ where: { codigo: 'novedades:crear' } });
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: rol.id, permisoId: perm.id } } });
    const r = await nueva(f1);
    await ctx.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: perm.id } });
    expect(r.status).toBe(403);
  });
});

describe('[HU09] consultar el estado de mis novedades', () => {
  let idMia;
  beforeAll(async () => { idMia = (await nueva(f2, { descripcion: 'Novedad registrada por el segundo funcionario' })).body.novedad.id; });

  it('cada funcionario ve solo las suyas', async () => {
    const m1 = await get('/novedades/mias', f1);
    const m2 = await get('/novedades/mias', f2);
    expect(m1.body.total).toBe(2);
    expect(m2.body.total).toBe(1);
    expect(m2.body.items[0].id).toBe(idMia);
    expect(m1.body.items.map((n) => n.id)).not.toContain(idMia);
  });
  it('el detalle propio incluye el historial de estados, sin datos de quien lo gestionó', async () => {
    const r = await get(`/novedades/mias/${idMia}`, f2);
    expect(r.status).toBe(200);
    expect(r.body.novedad.historial[0]).toMatchObject({ estadoNuevo: 'REGISTRADA' });
    expect(r.body.novedad.historial[0].por).toBeUndefined();
    expect(r.body.novedad.registradaPor).toBeUndefined();
  });
  it('la novedad de otro funcionario responde 404 (no revela que existe)', async () => {
    expect((await get(`/novedades/mias/${idMia}`, f1)).status).toBe(404);
    expect((await get('/novedades/mias/99999', f1)).status).toBe(404);
  });
  it('filtra por estado y pagina', async () => {
    expect((await get('/novedades/mias?estado=ATENDIDA', f1)).body.total).toBe(0);
    const p = await get('/novedades/mias?pageSize=1&page=2', f1);
    expect(p.body.items).toHaveLength(1);
    expect(p.body.total).toBe(2);
    expect((await get('/novedades/mias?estado=XX', f1)).status).toBe(400);
  });
  it('sin sesión → 401', async () => {
    expect((await ctx.api().get('/api/v1/novedades/mias')).status).toBe(401);
  });
});

describe('[HU15] consultar y gestionar todas las novedades (administrador)', () => {
  let id;
  beforeAll(async () => { id = (await nueva(f1, { descripcion: 'Novedad para probar la gestión de estados' })).body.novedad.id; });

  it('el funcionario no puede ver ni gestionar las del administrador (403)', async () => {
    expect((await get('/novedades', f1)).status).toBe(403);
    expect((await get(`/novedades/${id}`, f1)).status).toBe(403);
    expect((await patch(`/novedades/${id}/estado`, { estado: 'EN_REVISION' }, f1)).status).toBe(403);
  });
  it('lista todas con quién las registró y filtra por estado y texto', async () => {
    const r = await get('/novedades', admin);
    expect(r.body.total).toBeGreaterThanOrEqual(4);
    expect(r.body.items[0].registradaPor).toMatchObject({ nombres: expect.any(String) });
    expect((await get('/novedades?q=gestión', admin)).body.items.map((n) => n.id)).toEqual([id]);
    expect((await get('/novedades?q=79123', admin)).body.total).toBeGreaterThanOrEqual(3);
    expect((await get('/novedades?estado=EN_REVISION', admin)).body.total).toBe(0);
  });
  it('el detalle trae el historial con los nombres de quien gestionó', async () => {
    const r = await get(`/novedades/${id}`, admin);
    expect(r.body.novedad.historial[0].por).toMatchObject({ identificacion: '1050607080' });
  });
  it('flujo completo: REGISTRADA → EN_REVISION → ATENDIDA, con historial y auditoría', async () => {
    let r = await patch(`/novedades/${id}/estado`, { estado: 'EN_REVISION', comentario: 'Se asignó a un analista' }, admin);
    expect(r.status).toBe(200);
    expect(r.body.novedad).toMatchObject({ estado: 'EN_REVISION', siguientes: ['ATENDIDA', 'DESCARTADA'] });
    r = await patch(`/novedades/${id}/estado`, { estado: 'ATENDIDA' }, admin);
    expect(r.body.novedad.estado).toBe('ATENDIDA');
    expect(r.body.novedad.historial.map((h) => h.estadoNuevo)).toEqual(['REGISTRADA', 'EN_REVISION', 'ATENDIDA']);
    expect(r.body.novedad.historial[1]).toMatchObject({ estadoAnterior: 'REGISTRADA', comentario: 'Se asignó a un analista', por: { identificacion: '1000000001' } });
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'NOVEDAD_ESTADO', entidadId: String(id) } })).toBe(2);
  });
  it('el funcionario ve el nuevo estado y el comentario en su consulta (HU09)', async () => {
    const r = await get(`/novedades/mias/${id}`, f1);
    expect(r.body.novedad.estado).toBe('ATENDIDA');
    expect(r.body.novedad.historial[1].comentario).toBe('Se asignó a un analista');
  });
  it('un estado final no admite más cambios (409 con las transiciones permitidas)', async () => {
    const r = await patch(`/novedades/${id}/estado`, { estado: 'EN_REVISION' }, admin);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('TRANSICION_INVALIDA');
    expect(r.body.error.details.permitidas).toEqual([]);
  });
  it('no permite saltarse estados (REGISTRADA → ATENDIDA) y valida el estado enviado', async () => {
    const nuevaId = (await nueva(f1, { descripcion: 'Otra novedad para validar transiciones' })).body.novedad.id;
    const r = await patch(`/novedades/${nuevaId}/estado`, { estado: 'ATENDIDA' }, admin);
    expect(r.status).toBe(409);
    expect(r.body.error.details.permitidas).toEqual(['EN_REVISION', 'DESCARTADA']);
    expect((await patch(`/novedades/${nuevaId}/estado`, { estado: 'REGISTRADA' }, admin)).status).toBe(400);
  });
  it('descartar exige un comentario con el motivo', async () => {
    const nuevaId = (await nueva(f1, { descripcion: 'Novedad que será descartada después' })).body.novedad.id;
    const sin = await patch(`/novedades/${nuevaId}/estado`, { estado: 'DESCARTADA' }, admin);
    expect(sin.status).toBe(400);
    expect(sin.body.error.code).toBe('COMENTARIO_REQUERIDO');
    const con = await patch(`/novedades/${nuevaId}/estado`, { estado: 'DESCARTADA', comentario: 'Duplicada con otra novedad' }, admin);
    expect(con.body.novedad.estado).toBe('DESCARTADA');
  });
  it('dos cambios simultáneos sobre la misma novedad: solo uno prospera', async () => {
    const nuevaId = (await nueva(f1, { descripcion: 'Novedad para probar la concurrencia' })).body.novedad.id;
    const rs = await Promise.all([
      patch(`/novedades/${nuevaId}/estado`, { estado: 'EN_REVISION' }, admin),
      patch(`/novedades/${nuevaId}/estado`, { estado: 'DESCARTADA', comentario: 'Descartada a la vez' }, admin),
    ]);
    const codigos = rs.map((r) => r.status).sort();
    expect(codigos[0]).toBe(200);
    expect(codigos[1]).toBe(409);
    const hist = await ctx.prisma.novedadHistorial.count({ where: { novedadId: nuevaId } });
    expect(hist).toBe(2); // REGISTRADA + el único cambio que prosperó
  });
  it('novedad inexistente → 404', async () => {
    expect((await get('/novedades/99999', admin)).status).toBe(404);
    expect((await patch('/novedades/99999/estado', { estado: 'EN_REVISION' }, admin)).status).toBe(404);
  });
});

describe('integridad de la base de datos (novedades)', () => {
  it('el historial de estados es de solo inserción', async () => {
    await expect(ctx.prisma.$executeRawUnsafe("UPDATE novedad_historial SET comentario='x'")).rejects.toThrow(/solo inserci/i);
    await expect(ctx.prisma.$executeRawUnsafe('DELETE FROM novedad_historial')).rejects.toThrow(/solo inserci/i);
  });
  it('CHECK: la descripción debe tener al menos 10 caracteres reales', async () => {
    const c = await ctx.prisma.ciudadano.findFirst();
    const u = await ctx.prisma.usuario.findFirst();
    await expect(ctx.prisma.novedad.create({ data: { ciudadanoId: c.id, registradaPor: u.id, descripcion: '         x' } })).rejects.toThrow();
  });
});