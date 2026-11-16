import { hashPassword } from '../src/security/password.js';

// Catálogo SIMPLIFICADO con fines académicos (supuesto): no pretende reflejar el escalafón oficial completo.
export const FUERZAS = {
  'Policía': ['Patrullero', 'Subintendente', 'Intendente', 'Intendente Jefe', 'Subcomisario', 'Comisario', 'Subteniente', 'Teniente', 'Capitán', 'Mayor', 'Teniente Coronel', 'Coronel', 'Brigadier General', 'Mayor General', 'General'],
  'Ejército': ['Soldado Profesional', 'Cabo Tercero', 'Cabo Segundo', 'Cabo Primero', 'Sargento Viceprimero', 'Sargento Primero', 'Sargento Mayor', 'Subteniente', 'Teniente', 'Capitán', 'Mayor', 'Teniente Coronel', 'Coronel', 'Brigadier General', 'Mayor General', 'General'],
  'Armada': ['Marinero Profesional', 'Cabo Tercero', 'Cabo Segundo', 'Cabo Primero', 'Sargento Viceprimero', 'Sargento Primero', 'Sargento Mayor', 'Teniente de Corbeta', 'Teniente de Fragata', 'Teniente de Navío', 'Capitán de Corbeta', 'Capitán de Fragata', 'Capitán de Navío', 'Contralmirante', 'Vicealmirante', 'Almirante'],
  'Fuerza Aérea': ['Soldado Profesional', 'Técnico Cuarto', 'Técnico Tercero', 'Técnico Segundo', 'Técnico Primero', 'Técnico Jefe', 'Subteniente', 'Teniente', 'Capitán', 'Mayor', 'Teniente Coronel', 'Coronel', 'Brigadier General', 'Mayor General', 'General'],
};

// Opciones (módulos) y acciones. El código del permiso es "opcion:accion".
export const OPCIONES = {
  solicitudes: { nombre: 'Solicitudes de acceso', acciones: ['leer', 'resolver'] },
  usuarios: { nombre: 'Usuarios', acciones: ['leer', 'crear', 'editar'] },
  roles: { nombre: 'Roles y permisos', acciones: ['leer', 'crear', 'editar', 'eliminar'] },
  ciudadanos: { nombre: 'Ciudadanos', acciones: ['leer', 'crear', 'editar'] },
  consultas: { nombre: 'Consultas', acciones: ['crear', 'leer', 'leer_todas'] },
  novedades: { nombre: 'Novedades', acciones: ['crear', 'leer_propias', 'gestionar'] },
  reportes: { nombre: 'Reportes', acciones: ['leer'] },
};

const PERMISOS_FUNCIONARIO = ['consultas:crear', 'consultas:leer', 'novedades:crear', 'novedades:leer_propias'];

export const SIM_DEFENSA = [
  ['1020304050', 'Carlos Andrés', 'Vargas Mejía', 'Policía', 'Intendente', 'PN-48213'],
  ['1030405060', 'Laura Sofía', 'Ramírez Duque', 'Ejército', 'Capitán', 'EJ-77120'],
  ['1040506070', 'Julián David', 'Torres Peña', 'Armada', 'Teniente de Corbeta', 'AR-30955'],
  ['1050607080', 'Diana Marcela', 'Ortiz León', 'Fuerza Aérea', 'Teniente', 'FA-20418'],
  ['1060708090', 'Héctor Fabio', 'Salazar Nieto', 'Policía', 'Patrullero', 'PN-59001'],
];

export const CIUDADANOS_DEMO = [
  ['52000111', 'Ana María', 'Rojas Pineda', '1985-03-12', 'Bogotá D.C.', '2003-04-20', 'Bogotá D.C.', 'POSITIVO', 'O', 163, 'NO_REQUERIDO'],
  ['79123456', 'Jorge Enrique', 'Castaño Lara', '1979-11-02', 'Medellín', '1997-12-10', 'Medellín', 'POSITIVO', 'A', 175, 'REQUERIDO'],
  ['1012345678', 'Valentina', 'Cruz Moreno', '1998-07-25', 'Cali', '2016-08-30', 'Cali', 'NEGATIVO', 'O', 168, 'NO_REQUERIDO'],
  ['80987654', 'Andrés Felipe', 'Gómez Ríos', '1982-01-18', 'Barranquilla', '2000-02-14', 'Barranquilla', 'POSITIVO', 'B', 180, 'REQUERIDO'],
  ['00123456', 'Marta Lucía', 'Herrera Soto', '1960-09-05', 'Bucaramanga', '1978-10-11', 'Bucaramanga', 'NEGATIVO', 'A', 158, 'NO_REQUERIDO'],
  ['1098765432', 'Santiago', 'Peña Quintero', '2001-05-30', 'Cartagena', '2019-06-12', 'Cartagena', 'POSITIVO', 'AB', 177, 'NO_REQUERIDO'],
  ['41555666', 'Rosa Elvira', 'Díaz Camacho', '1955-12-20', 'Tunja', '1974-01-15', 'Tunja', 'POSITIVO', 'O', 154, 'NO_REQUERIDO'],
  ['1022334455', 'Camilo Esteban', 'Ruiz Vega', '1993-04-08', 'Pereira', '2011-05-02', 'Pereira', 'POSITIVO', 'B', 172, 'REQUERIDO'],
];

/** Datos base (idempotente): catálogos, opciones/permisos, roles y primer administrador. */
export async function seedBase(prisma, env = process.env) {
  for (const [nombre, rangos] of Object.entries(FUERZAS)) {
    const fuerza = await prisma.fuerzaPublica.upsert({ where: { nombre }, update: {}, create: { nombre } });
    for (const r of rangos) {
      await prisma.rango.upsert({
        where: { fuerzaPublicaId_nombre: { fuerzaPublicaId: fuerza.id, nombre: r } },
        update: {},
        create: { fuerzaPublicaId: fuerza.id, nombre: r },
      });
    }
  }

  const todos = [];
  for (const [codigo, { nombre, acciones }] of Object.entries(OPCIONES)) {
    const opcion = await prisma.opcion.upsert({ where: { codigo }, update: { nombre }, create: { codigo, nombre } });
    for (const accion of acciones) {
      const p = await prisma.permiso.upsert({
        where: { codigo: `${codigo}:${accion}` },
        update: {},
        create: { opcionId: opcion.id, accion, codigo: `${codigo}:${accion}` },
      });
      todos.push(p);
    }
  }

  const admin = await prisma.rol.upsert({
    where: { nombre: 'ADMINISTRADOR' },
    update: {},
    create: { nombre: 'ADMINISTRADOR', descripcion: 'Administra el sistema por la web', esBase: true },
  });
  const funcionario = await prisma.rol.upsert({
    where: { nombre: 'FUNCIONARIO' },
    update: {},
    create: { nombre: 'FUNCIONARIO', descripcion: 'Personal de la fuerza pública (app móvil)', esBase: true },
  });
  await prisma.rolPermiso.createMany({ data: todos.map((p) => ({ rolId: admin.id, permisoId: p.id })), skipDuplicates: true });
  await prisma.rolPermiso.createMany({
    data: todos.filter((p) => PERMISOS_FUNCIONARIO.includes(p.codigo)).map((p) => ({ rolId: funcionario.id, permisoId: p.id })),
    skipDuplicates: true,
  });

  // S-7: el primer administrador se crea por script de arranque. Debe cambiar la contraseña al ingresar.
  const identificacion = env.ADMIN_IDENTIFICACION;
  const password = env.ADMIN_INITIAL_PASSWORD;
  if (identificacion && password) {
    if (env.NODE_ENV === 'production' && password === 'Admin1') {
      throw new Error('Defina ADMIN_INITIAL_PASSWORD con un valor propio en producción');
    }
    const existente = await prisma.usuario.findUnique({ where: { identificacion } });
    if (!existente) {
      await prisma.usuario.create({
        data: {
          identificacion,
          nombres: env.ADMIN_NOMBRES ?? 'Administrador',
          apellidos: env.ADMIN_APELLIDOS ?? 'Del Sistema',
          correo: (env.ADMIN_CORREO ?? 'admin@example.test').toLowerCase(),
          rolId: admin.id,
          passwordHash: await hashPassword(password),
          debeCambiarPassword: true,
        },
      });
    }
  }
  return { admin, funcionario };
}

/** Datos ficticios de demostración (NO usar en producción). */
export async function seedDemo(prisma) {
  for (const [identificacion, nombres, apellidos, fuerza, rango, idFuerza] of SIM_DEFENSA) {
    await prisma.simDefensa.upsert({
      where: { identificacion },
      update: {},
      create: { identificacion, nombres, apellidos, fuerza, rango, idFuerza },
    });
  }
  for (const [identificacion, nombres, apellidos, nac, lugNac, exp, lugExp, rh, grupoSanguineo, estaturaCm, estadoJudicial] of CIUDADANOS_DEMO) {
    await prisma.ciudadano.upsert({
      where: { identificacion },
      update: {},
      create: {
        identificacion, nombres, apellidos,
        fechaNacimiento: new Date(`${nac}T00:00:00Z`), lugarNacimiento: lugNac,
        fechaExpedicion: new Date(`${exp}T00:00:00Z`), lugarExpedicion: lugExp,
        rh, grupoSanguineo, estaturaCm, estadoJudicial,
      },
    });
  }
}
