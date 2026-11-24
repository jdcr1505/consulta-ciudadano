import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/security/password.js';
import { auth, crearContexto, login, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';

let ctx; let admin; let f1; let f2; let idF1;
const consultar = (t, identificacion, origen = 'MANUAL') => ctx.api().post('/api/v1/consultas').set(auth(t)).send({ identificacion, origen });
const historial = (qs = '', t = f1) => ctx.api().get(`/api/v1/consultas${qs}`).set(auth(t));

async function funcionarioDirecto() {
  const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
  const fuerza = await ctx.prisma.fuerzaPublica.findUnique({ where: { nombre: 'Policía' } });
  const rango = await ctx.prisma.rango.findFirst({ where: { fuerzaPublicaId: fuerza.id } });
  await ctx.prisma.usuario.create({
    data: { identificacion: '7600000001', nombres: 'Otro', apellidos: 'Funcionario', correo: 'otro@example.test', rolId: rol.id, fuerzaPublicaId: fuerza.id, rangoId: rango.id, idFuerza: 'PN-76001', passwordHash: await hashPassword('Otro1234'), debeCambiarPassword: false },
  });
  return (await login(ctx, '7600000001', 'Otro1234')).body.accessToken;
}

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  f1 = await tokenFuncionario(ctx);
  f2 = await funcionarioDirecto();
  idF1 = (await ctx.prisma.usuario.findUnique({ where: { identificacion: '1050607080' } })).id;
  await consultar(f1, '79123456', 'ESCANER'); // requerido
  await consultar(f1, '52000111', 'MANUAL'); // no requerido
  await consultar(f1, '9000000009', 'MANUAL'); // no figura
  await consultar(f2, '80987654', 'ESCANER'); // requerido (otro funcionario)
});

describe('[HU07] historial del funcionario', () => {
  it('ve solo sus consultas, la más reciente primero, con resultado, origen y fecha', async () => {
    const r = await historial();
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.items.map((c) => c.identificacion)).toEqual(['9000000009', '52000111', '79123456']);
    expect(r.body.items[2]).toMatchObject({ resultado: 'REQUERIDO', registrado: true, origen: 'ESCANER', ciudadano: { nombres: 'Jorge Enrique', apellidos: 'Castaño Lara' } });
    expect(new Date(r.body.items[0].fechaHora).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
  it('quien no figura aparece como NO_REQUERIDO con registrado:false y sin datos personales', async () => {
    const c = (await historial()).body.items[0];
    expect(c).toMatchObject({ resultado: 'NO_REQUERIDO', registrado: false, ciudadano: null });
  });
  it('no expone quién más consultó ni datos de otros funcionarios', async () => {
    const r = await historial();
    expect(r.body.items.every((c) => c.funcionario === undefined)).toBe(true);
    expect(r.body.items.map((c) => c.identificacion)).not.toContain('80987654');
  });
  it('un funcionario no puede ver las de otro filtrando por usuarioId (se ignora el filtro)', async () => {
    const r = await historial(`?usuarioId=${idF1 + 1}`);
    expect(r.body.total).toBe(3);
  });
  it('filtra por resultado: REQUERIDO, NO_REQUERIDO (incluye los que no figuran) y NO_REGISTRADO', async () => {
    expect((await historial('?resultado=REQUERIDO')).body.total).toBe(1);
    expect((await historial('?resultado=NO_REQUERIDO')).body.total).toBe(2);
    expect((await historial('?resultado=NO_REGISTRADO')).body.items.map((c) => c.identificacion)).toEqual(['9000000009']);
  });
  it('filtra por identificación (prefijo) y por rango de fechas', async () => {
    expect((await historial('?identificacion=7912')).body.total).toBe(1);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    expect((await historial(`?desde=${hoy}&hasta=${hoy}`)).body.total).toBe(3);
    expect((await historial('?desde=2020-01-01&hasta=2020-12-31')).body.total).toBe(0);
    expect((await historial('?desde=mañana')).status).toBe(400);
  });
  it('pagina los resultados', async () => {
    const p = await historial('?pageSize=2&page=2');
    expect(p.body.items).toHaveLength(1);
    expect(p.body.total).toBe(3);
    expect((await historial('?pageSize=1000')).status).toBe(400);
  });
  it('sin sesión → 401; sin permiso de lectura → 403', async () => {
    expect((await ctx.api().get('/api/v1/consultas')).status).toBe(401);
    const perm = await ctx.prisma.permiso.findUnique({ where: { codigo: 'consultas:leer' } });
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: rol.id, permisoId: perm.id } } });
    const r = await historial();
    await ctx.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: perm.id } });
    expect(r.status).toBe(403);
  });
});

describe('[HU07] historial completo (administrador)', () => {
  it('ve las consultas de todos los funcionarios, con quién consultó', async () => {
    const r = await historial('', admin);
    expect(r.body.total).toBe(4);
    const del2 = r.body.items.find((c) => c.identificacion === '80987654');
    expect(del2.funcionario).toMatchObject({ identificacion: '7600000001', nombres: 'Otro' });
  });
  it('puede filtrar por funcionario y combinar filtros', async () => {
    expect((await historial(`?usuarioId=${idF1}`, admin)).body.total).toBe(3);
    expect((await historial(`?usuarioId=${idF1}&resultado=REQUERIDO`, admin)).body.total).toBe(1);
    expect((await historial('?resultado=REQUERIDO', admin)).body.total).toBe(2);
  });
  it('cada acceso al historial completo queda auditado', async () => {
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'HISTORIAL_CONSULTAS' } })).toBeGreaterThanOrEqual(3);
  });
});