import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/db.js';
import { SimDefensaProvider } from '../../src/integrations/defensa/SimDefensaProvider.js';
import { DevMailProvider } from '../../src/integrations/mail/DevMailProvider.js';
import { seedBase, seedDemo } from '../../prisma/seed-lib.js';

export const ADMIN = { identificacion: '1000000001', password: 'Admin1', nueva: 'Admin1x' };

// Crea la BD de pruebas si no existe (solo nombres seguros terminados en _test).
// Requiere que el usuario de la conexión tenga permiso CREATEDB.
async function asegurarBaseDeDatos(url) {
  const destino = new URL(url);
  const nombre = destino.pathname.slice(1);
  if (!/^[A-Za-z0-9_]+_test$/.test(nombre)) {
    throw new Error('Las pruebas solo pueden ejecutarse contra una BD cuyo nombre termine en _test');
  }
  const mantenimiento = new URL(url);
  mantenimiento.pathname = '/postgres';
  const client = new pg.Client({ connectionString: mantenimiento.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [nombre]);
    if (!rowCount) await client.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await client.end();
  }
}

// La BD de pruebas es desechable: se recrea el esquema completo con TODAS las migraciones vigentes,
// de modo que nunca queda desfasada respecto al código (solo se ejecuta si el nombre termina en _test).
async function asegurarEsquema(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    const dir = path.resolve('prisma/migrations');
    for (const carpeta of readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort()) {
      await client.query(readFileSync(path.join(dir, carpeta, 'migration.sql'), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

/** Crea app + BD limpia con datos base y demo. `mail` permite inyectar un proveedor (p. ej. uno que falle). */
export async function crearContexto({ env = {}, mail, ocr = null } = {}) {
  const cfg = loadConfig({ ...process.env, ...env });
  if (!/_test$/.test(new URL(cfg.databaseUrl).pathname)) {
    throw new Error('Las pruebas solo pueden ejecutarse contra una BD cuyo nombre termine en _test');
  }
  await asegurarBaseDeDatos(cfg.databaseUrl);
  await asegurarEsquema(cfg.databaseUrl);
  const prismaReal = createPrisma(cfg.databaseUrl);
  let caida = false;
  // Proxy que permite simular la caída de la base de datos en la búsqueda de ciudadanos.
  const prisma = new Proxy(prismaReal, {
    get(t, p) {
      if (p === 'ciudadano') {
        return new Proxy(t.ciudadano, {
          get(td, pp) {
            if (caida && pp === 'findMany') {
              return async () => { throw Object.assign(new Error("Can't reach database server at `localhost:5432`"), { code: 'P1001' }); };
            }
            const v = td[pp];
            return typeof v === 'function' ? v.bind(td) : v;
          },
        });
      }
      const v = Reflect.get(t, p);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  await prisma.$executeRawUnsafe(
    'TRUNCATE auditoria, consulta, sesion, solicitud, ciudadano, usuario, rol_permiso, permiso, opcion, rol, rango, fuerza_publica, sim_defensa RESTART IDENTITY CASCADE',
  );
  await seedBase(prisma, process.env);
  await seedDemo(prisma);
  const mailProvider = mail ?? new DevMailProvider(undefined, { persist: false });
  const defensa = new SimDefensaProvider(prisma);
  const app = createApp({ prisma, cfg, defensa, mail: mailProvider, ocr, logger: { error() {} } });
  return { app, prisma, cfg, mail: mailProvider, defensa, api: () => request(app), simularCaidaBD: (v) => { caida = v; } };
}

export const ultimaPassword = (mail) => {
  const m = mail.enviados.at(-1)?.texto.match(/\n {4}(\S{6})\n/);
  return m?.[1];
};

export async function login(ctx, identificacion, password, headers = {}) {
  return ctx.api().post('/api/v1/auth/login').set(headers).send({ identificacion, password });
}

/** Inicia sesión como administrador, cambia la contraseña inicial y devuelve el token vigente. */
export async function tokenAdmin(ctx) {
  const l = await login(ctx, ADMIN.identificacion, ADMIN.password);
  const c = await ctx.api().post('/api/v1/auth/cambiar-password').set('Authorization', `Bearer ${l.body.accessToken}`)
    .send({ passwordActual: ADMIN.password, passwordNueva: ADMIN.nueva });
  return c.body.accessToken;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export async function ids(ctx) {
  const r = await ctx.api().get('/api/v1/catalogos/fuerzas');
  const por = (n) => r.body.fuerzas.find((f) => f.nombre === n);
  return { fuerzas: r.body.fuerzas, policia: por('Policía'), ejercito: por('Ejército'), armada: por('Armada') };
}

export const rangoDe = (fuerza, nombre) => fuerza.rangos.find((r) => r.nombre === nombre).id;

/** Registra (vía solicitud validada) a un funcionario, cambia su contraseña temporal y devuelve su token. */
export async function tokenFuncionario(ctx, { identificacion = '1050607080', nombres = 'Diana Marcela', apellidos = 'Ortiz León', idFuerza = 'FA-20418', correo = 'diana@example.test' } = {}) {
  const cat = await ids(ctx);
  const fa = cat.fuerzas.find((f) => f.nombre === 'Fuerza Aérea');
  const r = await ctx.api().post('/api/v1/solicitudes').send({ identificacion, nombres, apellidos, fuerzaPublicaId: fa.id, rangoId: rangoDe(fa, 'Teniente'), idFuerza, correo });
  if (r.body.estado !== 'VALIDADA') throw new Error(`No se pudo registrar el funcionario de prueba: ${JSON.stringify(r.body)}`);
  const pwd = ultimaPassword(ctx.mail);
  const l = await login(ctx, identificacion, pwd);
  const c = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(l.body.accessToken)).send({ passwordActual: pwd, passwordNueva: 'Funcion1' });
  return c.body.accessToken;
}
