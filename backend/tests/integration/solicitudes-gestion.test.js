import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/security/password.js';
import { auth, crearContexto, ids, login, rangoDe, tokenAdmin, tokenFuncionario, ultimaPassword } from '../helpers/ctx.js';

let ctx; let admin; let cat; let ids3;
const get = (p, t = admin) => ctx.api().get(`/api/v1${p}`).set(auth(t));
const post = (p, b = {}, t = admin) => ctx.api().post(`/api/v1${p}`).set(auth(t)).send(b);
const registrar = (b) => ctx.api().post('/api/v1/solicitudes').send(b);
const base = (extra) => ({ nombres: 'Persona', apellidos: 'De Prueba', fuerzaPublicaId: cat.policia.id, rangoId: rangoDe(cat.policia, 'Capitán'), ...extra });

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  cat = await ids(ctx);
  await tokenFuncionario(ctx); // genera una solicitud VALIDADA (1050607080)
  // Pendiente por datos que no coinciden (apellido distinto del registro de Defensa)
  await registrar({ identificacion: '1060708090', nombres: 'Héctor Fabio', apellidos: 'Salazar Otro', fuerzaPublicaId: cat.policia.id, rangoId: rangoDe(cat.policia, 'Patrullero'), idFuerza: 'PN-59001', correo: 'hector@example.test' });
  // Pendientes: no figuran en Defensa
  await registrar(base({ identificacion: '1111111111', idFuerza: 'PN-00001', correo: 'nadie@example.test' }));
  await registrar(base({ identificacion: '1070809010', idFuerza: 'PN-00002', correo: 'tercero@example.test' }));
  const lista = await get('/solicitudes?pageSize=100');
  ids3 = Object.fromEntries(lista.body.items.map((s) => [s.identificacion, s.id]));
});

describe('[HU10] gestionar solicitudes', () => {
  it('lista todas, las más recientes primero, con fuerza, rango y resultado de la validación', async () => {
    const r = await get('/solicitudes');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(4);
    expect(r.body.items[0].identificacion).toBe('1070809010');
    const h = r.body.items.find((s) => s.identificacion === '1060708090');
    expect(h).toMatchObject({ estado: 'PENDIENTE_REVISION', resultadoValidacion: 'DATOS_NO_COINCIDEN', fuerza: { nombre: 'Policía' }, rango: { nombre: 'Patrullero' }, idFuerza: 'PN-59001' });
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash/i);
  });
  it('filtra por estado y busca por texto', async () => {
    const pend = await get('/solicitudes?estado=PENDIENTE_REVISION');
    expect(pend.body.total).toBe(3);
    expect((await get('/solicitudes?estado=VALIDADA')).body.total).toBe(1);
    expect((await get('/solicitudes?q=salazar')).body.items.map((s) => s.identificacion)).toEqual(['1060708090']);
    expect((await get('/solicitudes?q=1111')).body.total).toBe(1);
    expect((await get('/solicitudes?q=NADIE@EXAMPLE')).body.total).toBe(1);
    expect((await get('/solicitudes?estado=OTRO')).status).toBe(400);
  });
  it('pagina los resultados', async () => {
    const r = await get('/solicitudes?pageSize=2&page=2');
    expect(r.body.items).toHaveLength(2);
    expect(r.body.total).toBe(4);
  });
  it('el detalle responde 200 y 404/400 si no existe o el id es inválido', async () => {
    expect((await get(`/solicitudes/${ids3['1060708090']}`)).body.solicitud.nombres).toBe('Héctor Fabio');
    expect((await get('/solicitudes/99999')).status).toBe(404);
    expect((await get('/solicitudes/abc')).status).toBe(400);
  });
  it('exige sesión y el permiso solicitudes:leer (el registro público sigue abierto)', async () => {
    expect((await ctx.api().get('/api/v1/solicitudes')).status).toBe(401);
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.usuario.create({ data: { identificacion: '7400000001', nombres: 'Solo', apellidos: 'Funcionario', correo: 'solo@example.test', rolId: rol.id, passwordHash: await hashPassword('Solo1234'), debeCambiarPassword: false } });
    const t = (await login(ctx, '7400000001', 'Solo1234')).body.accessToken;
    expect((await get('/solicitudes', t)).status).toBe(403);
    expect((await post(`/solicitudes/${ids3['1060708090']}/aprobar`, {}, t)).status).toBe(403);
  });
});

describe('[HU11] aprobar o rechazar', () => {
  it('aprobar crea el usuario FUNCIONARIO, envía la contraseña temporal y registra quién y cuándo', async () => {
    const antes = ctx.mail.enviados.length;
    const r = await post(`/solicitudes/${ids3['1060708090']}/aprobar`);
    expect(r.status).toBe(200);
    expect(r.body.solicitud).toMatchObject({ estado: 'APROBADA', resueltaPor: { nombres: 'Administrador' } });
    expect(r.body.solicitud.resueltaEn).toBeTruthy();
    expect(ctx.mail.enviados.length).toBe(antes + 1);
    expect(ctx.mail.enviados.at(-1).para).toBe('hector@example.test');
    const pwd = ultimaPassword(ctx.mail);
    expect(JSON.stringify(r.body)).not.toContain(pwd);

    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1060708090' }, include: { rol: true, solicitud: true } });
    expect(u).toMatchObject({ debeCambiarPassword: true, estado: 'ACTIVO', fuerzaPublicaId: cat.policia.id });
    expect(u.rol.nombre).toBe('FUNCIONARIO');
    expect(u.solicitud.id).toBe(ids3['1060708090']);
    const l = await login(ctx, '1060708090', pwd);
    expect(l.status).toBe(200);
    expect(l.body.usuario.debeCambiarPassword).toBe(true);
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'SOLICITUD_APROBADA' } })).toBe(1);
  });
  it('una solicitud ya resuelta, o validada automáticamente, no se puede resolver de nuevo (409)', async () => {
    const otra = await post(`/solicitudes/${ids3['1060708090']}/aprobar`);
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('SOLICITUD_NO_PENDIENTE');
    const validada = (await get('/solicitudes?estado=VALIDADA')).body.items[0];
    expect((await post(`/solicitudes/${validada.id}/rechazar`, { motivo: 'Intento de rechazo' })).status).toBe(409);
  });
  it('si ya existe un usuario con esa identificación → 409 y la solicitud sigue pendiente', async () => {
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.usuario.create({ data: { identificacion: '1070809010', nombres: 'Ya', apellidos: 'Existe', correo: 'yaexiste@example.test', rolId: rol.id, passwordHash: 'x' } });
    const r = await post(`/solicitudes/${ids3['1070809010']}/aprobar`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('USUARIO_YA_REGISTRADO');
    expect((await get(`/solicitudes/${ids3['1070809010']}`)).body.solicitud.estado).toBe('PENDIENTE_REVISION');
  });
  it('si el correo falla (503) se revierte todo: sigue pendiente y no queda usuario', async () => {
    const original = ctx.mail.enviarCredenciales;
    ctx.mail.enviarCredenciales = async () => { throw new Error('SMTP caído'); };
    const r = await post(`/solicitudes/${ids3['1111111111']}/aprobar`);
    ctx.mail.enviarCredenciales = original;
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('CORREO_NO_DISPONIBLE');
    expect(await ctx.prisma.usuario.findUnique({ where: { identificacion: '1111111111' } })).toBeNull();
    expect((await get(`/solicitudes/${ids3['1111111111']}`)).body.solicitud.estado).toBe('PENDIENTE_REVISION');
  });
  it('dos aprobaciones simultáneas: solo una prospera y se envía un solo correo', async () => {
    const antes = ctx.mail.enviados.length;
    const rs = await Promise.all([post(`/solicitudes/${ids3['1111111111']}/aprobar`), post(`/solicitudes/${ids3['1111111111']}/aprobar`)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(ctx.mail.enviados.length).toBe(antes + 1);
    expect(await ctx.prisma.usuario.count({ where: { identificacion: '1111111111' } })).toBe(1);
  });
  it('rechazar exige un motivo y deja la solicitud RECHAZADA sin dar acceso', async () => {
    const id = ids3['1070809010'];
    await ctx.prisma.usuario.delete({ where: { identificacion: '1070809010' } }); // libera la identificación usada en la prueba anterior
    expect((await post(`/solicitudes/${id}/rechazar`, {})).status).toBe(400);
    expect((await post(`/solicitudes/${id}/rechazar`, { motivo: 'no' })).status).toBe(400);
    const r = await post(`/solicitudes/${id}/rechazar`, { motivo: 'Los datos no corresponden a personal activo' });
    expect(r.status).toBe(200);
    expect(r.body.solicitud).toMatchObject({ estado: 'RECHAZADA', motivo: 'Los datos no corresponden a personal activo', resueltaPor: { nombres: 'Administrador' } });
    expect(await ctx.prisma.usuario.findUnique({ where: { identificacion: '1070809010' } })).toBeNull();
    expect((await login(ctx, '1070809010', 'Cualquier1')).status).toBe(401);
    expect((await post(`/solicitudes/${id}/rechazar`, { motivo: 'Otro intento más' })).status).toBe(409);
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'SOLICITUD_RECHAZADA' } })).toBe(1);
  });
  it('tras un rechazo la persona puede volver a solicitar acceso', async () => {
    const r = await registrar(base({ identificacion: '1070809010', idFuerza: 'PN-00002', correo: 'tercero@example.test' }));
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('PENDIENTE_REVISION');
  });
  it('un rol con solicitudes:leer pero sin solicitudes:resolver puede consultar y no resolver (403)', async () => {
    const leer = await ctx.prisma.permiso.findUnique({ where: { codigo: 'solicitudes:leer' } });
    const rol = await ctx.prisma.rol.create({ data: { nombre: 'Auditor de solicitudes' } });
    await ctx.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: leer.id } });
    await ctx.prisma.usuario.create({ data: { identificacion: '7500000001', nombres: 'Aura', apellidos: 'Auditora', correo: 'aura@example.test', rolId: rol.id, passwordHash: await hashPassword('Auditor1'), debeCambiarPassword: false } });
    const t = (await login(ctx, '7500000001', 'Auditor1')).body.accessToken;
    expect((await get('/solicitudes', t)).status).toBe(200);
    const pendiente = (await get('/solicitudes?estado=PENDIENTE_REVISION', t)).body.items[0];
    expect((await post(`/solicitudes/${pendiente.id}/aprobar`, {}, t)).status).toBe(403);
    expect((await post(`/solicitudes/${pendiente.id}/rechazar`, { motivo: 'Sin permiso para esto' }, t)).status).toBe(403);
  });
});