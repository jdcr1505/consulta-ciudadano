import { beforeAll, describe, expect, it } from 'vitest';
import { crearContexto, ids, rangoDe, ultimaPassword, login } from '../helpers/ctx.js';
import { DevMailProvider } from '../../src/integrations/mail/DevMailProvider.js';

let ctx; let cat;
const post = (body) => ctx.api().post('/api/v1/solicitudes').send(body);
const valida = () => ({
  identificacion: '1020304050', nombres: 'Carlos Andrés', apellidos: 'Vargas Mejía',
  fuerzaPublicaId: cat.policia.id, rangoId: rangoDe(cat.policia, 'Intendente'), idFuerza: 'PN-48213', correo: 'carlos.vargas@example.test',
});

beforeAll(async () => { ctx = await crearContexto(); cat = await ids(ctx); });

describe('[HU01] catálogos para el registro', () => {
  it('expone las 4 fuerzas con sus rangos', () => {
    expect(cat.fuerzas.map((f) => f.nombre)).toEqual(['Policía', 'Ejército', 'Armada', 'Fuerza Aérea']);
    expect(cat.policia.rangos.length).toBeGreaterThan(5);
  });
  it('GET /catalogos/fuerzas/:id/rangos devuelve solo rangos de esa fuerza', async () => {
    const r = await ctx.api().get(`/api/v1/catalogos/fuerzas/${cat.armada.id}/rangos`);
    expect(r.status).toBe(200);
    expect(r.body.rangos.map((x) => x.nombre)).toContain('Teniente de Corbeta');
    expect((await ctx.api().get('/api/v1/catalogos/fuerzas/9999/rangos')).status).toBe(404);
  });
});

describe('[HU01][HU02] registro válido y credenciales', () => {
  it('valida contra Defensa simulada, crea el usuario y envía la contraseña temporal por correo', async () => {
    const r = await post(valida());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'VALIDADA', resultadoValidacion: 'VALIDADO' });

    const pwd = ultimaPassword(ctx.mail);
    expect(pwd).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6}$/);
    expect(ctx.mail.enviados.at(-1).para).toBe('carlos.vargas@example.test');
    // la contraseña no viaja en la respuesta HTTP
    expect(JSON.stringify(r.body)).not.toContain(pwd);

    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1020304050' }, include: { rol: true } });
    expect(u.rol.nombre).toBe('FUNCIONARIO');
    expect(u.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(u.passwordHash).not.toContain(pwd);
    expect(u.debeCambiarPassword).toBe(true);
    const horas = (u.passwordExpiraEn - Date.now()) / 3600_000;
    expect(horas).toBeGreaterThan(23.9);
    expect(horas).toBeLessThanOrEqual(24);
    const s = await ctx.prisma.solicitud.findFirst({ where: { identificacion: '1020304050' } });
    expect(s).toMatchObject({ estado: 'VALIDADA', usuarioId: u.id });
  });

  it('no registra la contraseña en la auditoría', async () => {
    const pwd = ultimaPassword(ctx.mail);
    const filas = await ctx.prisma.auditoria.findMany();
    expect(filas.length).toBeGreaterThan(0);
    expect(JSON.stringify(filas, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(pwd);
  });

  it('rechaza duplicar un acceso ya existente (409)', async () => {
    const r = await post(valida());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('USUARIO_YA_REGISTRADO');
  });
});

describe('[HU01] solicitudes que no se validan automáticamente', () => {
  it('datos que no coinciden → pendiente de revisión, sin usuario ni correo', async () => {
    const antes = ctx.mail.enviados.length;
    const r = await post({ ...valida(), identificacion: '1060708090', nombres: 'Otro Nombre', apellidos: 'Salazar Nieto', rangoId: rangoDe(cat.policia, 'Patrullero'), idFuerza: 'PN-59001', correo: 'hector@example.test' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'PENDIENTE_REVISION', resultadoValidacion: 'DATOS_NO_COINCIDEN' });
    expect(ctx.mail.enviados.length).toBe(antes);
    expect(await ctx.prisma.usuario.findUnique({ where: { identificacion: '1060708090' } })).toBeNull();
  });

  it('una solicitud pendiente NO confiere acceso', async () => {
    const l = await login(ctx, '1060708090', 'Cualquier1');
    expect(l.status).toBe(401);
  });

  it('no encontrado en Defensa → pendiente (NO_ENCONTRADO)', async () => {
    const r = await post({ ...valida(), identificacion: '1111111111', correo: 'nadie@example.test', idFuerza: 'PN-00001' });
    expect(r.body).toMatchObject({ estado: 'PENDIENTE_REVISION', resultadoValidacion: 'NO_ENCONTRADO' });
  });

  it('servicio de Defensa caído → pendiente (SERVICIO_NO_DISPONIBLE), nunca aprobado', async () => {
    const r = await post({ ...valida(), identificacion: '9999999999', correo: 'caida@example.test' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'PENDIENTE_REVISION', resultadoValidacion: 'SERVICIO_NO_DISPONIBLE' });
  });

  it('impide dos solicitudes pendientes para la misma identificación (409)', async () => {
    const r = await post({ ...valida(), identificacion: '1111111111', correo: 'otro@example.test', idFuerza: 'PN-00001' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SOLICITUD_PENDIENTE');
  });
});

describe('[HU01] validaciones de entrada', () => {
  it('campos obligatorios faltantes → 400 con detalle por campo', async () => {
    const r = await post({});
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDACION');
    const campos = r.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['identificacion', 'nombres', 'apellidos', 'fuerzaPublicaId', 'rangoId', 'idFuerza', 'correo']));
  });
  it.each([
    ['identificación con letras', { identificacion: '12ab56' }, 'identificacion'],
    ['identificación muy corta', { identificacion: '123' }, 'identificacion'],
    ['correo inválido', { correo: 'no-es-correo' }, 'correo'],
    ['nombres con números', { nombres: 'Juan123' }, 'nombres'],
    ['ID Fuerza con símbolos', { idFuerza: 'PN 48;213' }, 'idFuerza'],
  ])('%s → 400', async (_n, cambio, campo) => {
    const r = await post({ ...valida(), identificacion: '1234567890', ...cambio });
    expect(r.status).toBe(400);
    expect(r.body.error.details.map((d) => d.campo)).toContain(campo);
  });
  it('rango que no pertenece a la fuerza → 400 FUERZA_RANGO_INVALIDO', async () => {
    const r = await post({ ...valida(), identificacion: '1234567890', correo: 'x@example.test', rangoId: rangoDe(cat.armada, 'Almirante') });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('FUERZA_RANGO_INVALIDO');
  });
});

describe('[HU02] fallo del correo', () => {
  it('revierte el alta si el correo no se puede enviar (503) y no deja usuario huérfano', async () => {
    const fallido = new DevMailProvider(undefined, { persist: false });
    fallido.enviarCredenciales = async () => { throw new Error('SMTP caído'); };
    const c2 = await crearContexto({ mail: fallido });
    const cat2 = await ids(c2);
    const r = await c2.api().post('/api/v1/solicitudes').send({
      identificacion: '1030405060', nombres: 'Laura Sofía', apellidos: 'Ramírez Duque',
      fuerzaPublicaId: cat2.ejercito.id, rangoId: rangoDe(cat2.ejercito, 'Capitán'), idFuerza: 'EJ-77120', correo: 'laura@example.test',
    });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('CORREO_NO_DISPONIBLE');
    expect(await c2.prisma.usuario.findUnique({ where: { identificacion: '1030405060' } })).toBeNull();
    expect(await c2.prisma.solicitud.count({ where: { identificacion: '1030405060' } })).toBe(0);
    await c2.prisma.$disconnect();
  });
});
