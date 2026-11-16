import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, tokenAdmin } from '../helpers/ctx.js';

let ctx; let admin;
const get = (p) => ctx.api().get(`/api/v1${p}`).set(auth(admin));
const post = (p, b) => ctx.api().post(`/api/v1${p}`).set(auth(admin)).send(b);
const patch = (p, b) => ctx.api().patch(`/api/v1${p}`).set(auth(admin)).send(b);

const valido = (extra = {}) => ({
  identificacion: '0098765', nombres: 'Lucía Fernanda', apellidos: 'Mora Salgado',
  fechaNacimiento: '1990-06-15', lugarNacimiento: 'Neiva', fechaExpedicion: '2008-07-01', lugarExpedicion: 'Neiva',
  rh: 'NEGATIVO', grupoSanguineo: 'AB', estaturaCm: 165, ...extra,
});

beforeAll(async () => { ctx = await crearContexto(); admin = await tokenAdmin(ctx); });

describe('[HU14] registrar ciudadanos', () => {
  it('crea un ciudadano con los 10 datos, conserva ceros iniciales y estado por defecto NO_REQUERIDO', async () => {
    const r = await post('/ciudadanos', valido());
    expect(r.status).toBe(201);
    expect(r.body.ciudadano).toMatchObject({
      identificacion: '0098765', nombres: 'Lucía Fernanda', apellidos: 'Mora Salgado', fechaNacimiento: '1990-06-15', lugarNacimiento: 'Neiva',
      fechaExpedicion: '2008-07-01', lugarExpedicion: 'Neiva', rh: 'NEGATIVO', grupoSanguineo: 'AB', estaturaCm: 165,
      estadoJudicial: 'NO_REQUERIDO', activo: true,
    });
  });
  it('rechaza identificación duplicada (409)', async () => {
    const r = await post('/ciudadanos', valido());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CIUDADANO_DUPLICADO');
  });
  it('identificaciones con distinto cero inicial son distintas (texto, no número)', async () => {
    expect((await post('/ciudadanos', valido({ identificacion: '98765' + '00' }))).status).toBe(201);
    expect((await post('/ciudadanos', valido({ identificacion: '9876500' }))).status).toBe(409);
  });
  it.each([
    ['campos obligatorios', {}, ['identificacion', 'nombres', 'apellidos', 'fechaNacimiento', 'rh', 'grupoSanguineo', 'estaturaCm']],
    ['identificación no numérica', { identificacion: 'ABC123' }, ['identificacion']],
    ['fecha de nacimiento futura', { fechaNacimiento: '2999-01-01', fechaExpedicion: '2999-02-01' }, ['fechaNacimiento']],
    ['fecha inexistente', { fechaNacimiento: '1990-02-31' }, ['fechaNacimiento']],
    ['expedición anterior al nacimiento', { fechaExpedicion: '1980-01-01' }, ['fechaExpedicion']],
    ['estatura fuera de rango', { estaturaCm: 20 }, ['estaturaCm']],
    ['RH inválido', { rh: 'X' }, ['rh']],
    ['grupo sanguíneo inválido', { grupoSanguineo: 'C' }, ['grupoSanguineo']],
    ['nombres con números', { nombres: 'Ana2' }, ['nombres']],
  ])('valida %s → 400', async (_n, cambio, campos) => {
    const body = _n === 'campos obligatorios' ? {} : valido({ identificacion: '5555555', ...cambio });
    const r = await post('/ciudadanos', body);
    expect(r.status).toBe(400);
    expect(r.body.error.details.map((d) => d.campo)).toEqual(expect.arrayContaining(campos));
  });
});

describe('[HU14] consultar y modificar', () => {
  it('busca por prefijo de identificación, nombre y estado judicial (datos ficticios del seed)', async () => {
    expect((await get('/ciudadanos?identificacion=79123')).body.items.map((c) => c.identificacion)).toEqual(['79123456']);
    expect((await get('/ciudadanos?q=rojas')).body.items[0].nombres).toBe('Ana María');
    const req = await get('/ciudadanos?estadoJudicial=REQUERIDO');
    expect(req.body.total).toBe(3);
    expect(req.body.items.every((c) => c.estadoJudicial === 'REQUERIDO')).toBe(true);
  });
  it('pagina los resultados', async () => {
    const p = await get('/ciudadanos?pageSize=3&page=2');
    expect(p.body.items).toHaveLength(3);
    expect(p.body.total).toBeGreaterThanOrEqual(10);
    expect((await get('/ciudadanos?pageSize=1000')).status).toBe(400);
  });
  it('obtiene por id (404 si no existe)', async () => {
    const c = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '52000111' } });
    expect((await get(`/ciudadanos/${c.id}`)).body.ciudadano.identificacion).toBe('52000111');
    expect((await get('/ciudadanos/99999')).status).toBe(404);
  });
  it('modifica datos y estado judicial; la identificación no cambia', async () => {
    const c = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '52000111' } });
    const r = await patch(`/ciudadanos/${c.id}`, { lugarExpedicion: 'Soacha', estaturaCm: 164, estadoJudicial: 'REQUERIDO', identificacion: '1' });
    expect(r.status).toBe(200);
    expect(r.body.ciudadano).toMatchObject({ identificacion: '52000111', lugarExpedicion: 'Soacha', estaturaCm: 164, estadoJudicial: 'REQUERIDO' });
  });
  it('valida la coherencia de fechas contra los datos ya almacenados', async () => {
    const c = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '52000111' } });
    const r = await patch(`/ciudadanos/${c.id}`, { fechaExpedicion: '1970-01-01' });
    expect(r.status).toBe(400);
    expect(r.body.error.details[0].campo).toBe('fechaExpedicion');
    expect((await patch(`/ciudadanos/${c.id}`, {})).status).toBe(400);
  });
  it('desactiva y reactiva (sin borrado físico)', async () => {
    const c = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '52000111' } });
    expect((await patch(`/ciudadanos/${c.id}/activo`, { activo: false })).body.ciudadano.activo).toBe(false);
    expect((await get('/ciudadanos?activo=false')).body.items.map((x) => x.identificacion)).toContain('52000111');
    expect((await patch(`/ciudadanos/${c.id}/activo`, { activo: true })).body.ciudadano.activo).toBe(true);
    expect(await ctx.prisma.ciudadano.count({ where: { identificacion: '52000111' } })).toBe(1);
    expect((await patch(`/ciudadanos/${c.id}/activo`, { activo: 'si' })).status).toBe(400);
  });
  it('registra auditoría de las operaciones', async () => {
    const acciones = (await ctx.prisma.auditoria.findMany({ where: { entidad: 'ciudadano' } })).map((a) => a.accion);
    expect(acciones).toEqual(expect.arrayContaining(['CIUDADANO_CREADO', 'CIUDADANO_EDITADO', 'CIUDADANO_DESACTIVADO', 'CIUDADANO_ACTIVADO']));
  });
});
