import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, auth, crearContexto, ids, login, rangoDe, tokenAdmin, ultimaPassword } from '../helpers/ctx.js';

let ctx; let cat; let adminToken;
const MOVIL = { 'x-client-type': 'mobile' };

async function registrarFuncionario() {
  const r = await ctx.api().post('/api/v1/solicitudes').send({
    identificacion: '1030405060', nombres: 'Laura Sofía', apellidos: 'Ramírez Duque',
    fuerzaPublicaId: cat.ejercito.id, rangoId: rangoDe(cat.ejercito, 'Capitán'), idFuerza: 'EJ-77120', correo: 'laura@example.test',
  });
  expect(r.body.estado).toBe('VALIDADA');
  return ultimaPassword(ctx.mail);
}

beforeAll(async () => {
  ctx = await crearContexto();
  cat = await ids(ctx);
  adminToken = await tokenAdmin(ctx);
});

describe('[HU03] validación de campos (CA04) y credenciales (CA03/CA09)', () => {
  it('identificación y contraseña obligatorias → 400 con mensajes por campo', async () => {
    const r = await ctx.api().post('/api/v1/auth/login').send({});
    expect(r.status).toBe(400);
    expect(r.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'identificacion', mensaje: 'La identificación es obligatoria' }),
      expect.objectContaining({ campo: 'password', mensaje: 'La contraseña es obligatoria' }),
    ]));
  });

  it('mismo mensaje genérico para usuario inexistente y contraseña errónea (no revela cuál falló)', async () => {
    const a = await login(ctx, '5555555555', 'Cualquier1');
    const b = await login(ctx, ADMIN.identificacion, 'Equivocada1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toEqual(b.body.error);
    expect(a.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('login correcto devuelve token, expiración y datos de sesión sin hashes', async () => {
    const r = await login(ctx, ADMIN.identificacion, ADMIN.nueva);
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.expiresIn).toBe(900);
    expect(r.body.usuario).toMatchObject({ identificacion: ADMIN.identificacion, rol: 'ADMINISTRADOR', debeCambiarPassword: false });
    expect(r.body.usuario.permisos).toContain('roles:editar');
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|argon2/);
  });
});

describe('[HU03] bloqueo por intentos fallidos', () => {
  it('bloquea la cuenta tras MAX_LOGIN_ATTEMPTS (3) y rechaza incluso la contraseña correcta', async () => {
    const pwd = await registrarFuncionario();
    for (let i = 0; i < 3; i++) expect((await login(ctx, '1030405060', 'Mala1pass')).status).toBe(401);
    const r = await login(ctx, '1030405060', pwd);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CUENTA_BLOQUEADA');
    // el administrador puede restablecer la contraseña, lo que desbloquea la cuenta
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1030405060' } });
    const rr = await ctx.api().post(`/api/v1/usuarios/${u.id}/restablecer-password`).set(auth(adminToken));
    expect(rr.status).toBe(204);
    expect((await login(ctx, '1030405060', ultimaPassword(ctx.mail))).status).toBe(200);
  });
});

describe('[HU03][HU02] contraseña temporal y cambio obligatorio (CA08)', () => {
  let token; let temporal;
  beforeAll(async () => {
    await ctx.prisma.usuario.deleteMany({ where: { identificacion: '1040506070' } });
    const r = await ctx.api().post('/api/v1/solicitudes').send({
      identificacion: '1040506070', nombres: 'Julián David', apellidos: 'Torres Peña',
      fuerzaPublicaId: cat.armada.id, rangoId: rangoDe(cat.armada, 'Teniente de Corbeta'), idFuerza: 'AR-30955', correo: 'julian@example.test',
    });
    expect(r.body.estado).toBe('VALIDADA');
    temporal = ultimaPassword(ctx.mail);
  });

  it('con contraseña temporal, solo puede cambiarla: el resto de la API responde 403', async () => {
    const l = await login(ctx, '1040506070', temporal);
    expect(l.status).toBe(200);
    expect(l.body.usuario.debeCambiarPassword).toBe(true);
    token = l.body.accessToken;
    const bloqueada = await ctx.api().get('/api/v1/ciudadanos').set(auth(token));
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.error.code).toBe('CAMBIO_PASSWORD_REQUERIDO');
    expect((await ctx.api().get('/api/v1/auth/me').set(auth(token))).status).toBe(200);
  });

  it.each([
    ['sin mayúscula', 'abcde1'],
    ['sin número', 'Abcdef'],
    ['muy corta', 'Ab1'],
  ])('rechaza contraseña nueva %s', async (_n, nueva) => {
    const r = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(token)).send({ passwordActual: temporal, passwordNueva: nueva });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PASSWORD_NO_CUMPLE_POLITICA');
  });

  it('rechaza contraseña actual incorrecta y contraseña repetida', async () => {
    const a = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(token)).send({ passwordActual: 'Nope123', passwordNueva: 'Nueva123' });
    expect(a.body.error.code).toBe('PASSWORD_ACTUAL_INCORRECTA');
    const b = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(token)).send({ passwordActual: temporal, passwordNueva: temporal });
    expect(b.body.error.code).toBe('PASSWORD_REPETIDA');
  });

  it('cambia la contraseña, libera el acceso y deja de aceptar la temporal', async () => {
    const r = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(token)).send({ passwordActual: temporal, passwordNueva: 'Nueva123' });
    expect(r.status).toBe(200);
    expect(r.body.usuario.debeCambiarPassword).toBe(false);
    expect((await login(ctx, '1040506070', temporal)).status).toBe(401);
    const l = await login(ctx, '1040506070', 'Nueva123');
    expect(l.status).toBe(200);
    // sin permiso, pero ya no por el cambio pendiente
    const acc = await ctx.api().get('/api/v1/ciudadanos').set(auth(l.body.accessToken));
    expect(acc.status).toBe(403);
    expect(acc.body.error.code).toBe('SIN_PERMISO');
  });

  it('la contraseña temporal vencida no permite ingresar', async () => {
    await ctx.prisma.usuario.update({
      where: { identificacion: '1040506070' },
      data: { debeCambiarPassword: true, passwordExpiraEn: new Date(Date.now() - 1000) },
    });
    const r = await login(ctx, '1040506070', 'Nueva123');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('PASSWORD_TEMPORAL_EXPIRADA');
  });
});

describe('[HU03] usuarios inactivos (CA09)', () => {
  it('un usuario inactivo no puede ingresar y recibe el mismo mensaje genérico', async () => {
    await ctx.prisma.usuario.update({ where: { identificacion: '1040506070' }, data: { estado: 'INACTIVO', debeCambiarPassword: false, passwordExpiraEn: null } });
    const r = await login(ctx, '1040506070', 'Nueva123');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('desactivar a un usuario invalida su token vigente y sus sesiones', async () => {
    await ctx.prisma.usuario.update({ where: { identificacion: '1040506070' }, data: { estado: 'ACTIVO' } });
    const l = await login(ctx, '1040506070', 'Nueva123', MOVIL);
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1040506070' } });
    const d = await ctx.api().patch(`/api/v1/usuarios/${u.id}/estado`).set(auth(adminToken)).send({ estado: 'INACTIVO' });
    expect(d.status).toBe(200);
    expect((await ctx.api().get('/api/v1/auth/me').set(auth(l.body.accessToken))).status).toBe(401);
    expect((await ctx.api().post('/api/v1/auth/refresh').set(MOVIL).send({ refreshToken: l.body.refreshToken })).status).toBe(401);
  });
});

describe('[HU03] sesión: tokens, refresh y cierre de sesión', () => {
  it('web: el refresh token va en cookie httpOnly SameSite=Strict y no en el cuerpo', async () => {
    const r = await login(ctx, ADMIN.identificacion, ADMIN.nueva);
    expect(r.body.refreshToken).toBeUndefined();
    const cookie = r.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('móvil: refresh con rotación y detección de reutilización', async () => {
    const l = await login(ctx, ADMIN.identificacion, ADMIN.nueva, MOVIL);
    const r1 = await ctx.api().post('/api/v1/auth/refresh').set(MOVIL).send({ refreshToken: l.body.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(l.body.refreshToken);
    // reutilizar el token ya rotado: rechazado y revoca todas las sesiones
    const reuso = await ctx.api().post('/api/v1/auth/refresh').set(MOVIL).send({ refreshToken: l.body.refreshToken });
    expect(reuso.status).toBe(401);
    const nuevo = await ctx.api().post('/api/v1/auth/refresh').set(MOVIL).send({ refreshToken: r1.body.refreshToken });
    expect(nuevo.status).toBe(401);
  });

  it('logout revoca la sesión (el refresh deja de funcionar)', async () => {
    const l = await login(ctx, ADMIN.identificacion, ADMIN.nueva, MOVIL);
    const out = await ctx.api().post('/api/v1/auth/logout').set({ ...MOVIL, ...auth(l.body.accessToken) }).send({ refreshToken: l.body.refreshToken });
    expect(out.status).toBe(204);
    expect((await ctx.api().post('/api/v1/auth/refresh').set(MOVIL).send({ refreshToken: l.body.refreshToken })).status).toBe(401);
  });

  it('rechaza tokens ausentes, malformados o firmados con otra clave', async () => {
    expect((await ctx.api().get('/api/v1/auth/me')).status).toBe(401);
    expect((await ctx.api().get('/api/v1/auth/me').set(auth('basura'))).status).toBe(401);
    const jwt = (await import('jsonwebtoken')).default;
    const falso = jwt.sign({ sub: '1' }, 'otra-clave-distinta-0123456789abcdef', { issuer: 'consulta-ciudadano' });
    const r = await ctx.api().get('/api/v1/auth/me').set(auth(falso));
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('TOKEN_INVALIDO');
  });
});
