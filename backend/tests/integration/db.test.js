import { beforeAll, describe, expect, it } from 'vitest';
import { crearContexto } from '../helpers/ctx.js';

let ctx;
beforeAll(async () => { ctx = await crearContexto(); });

describe('integridad a nivel de base de datos', () => {
  it('auditoría es de solo inserción: UPDATE y DELETE fallan', async () => {
    await ctx.prisma.auditoria.create({ data: { accion: 'PRUEBA', resultado: 'OK' } });
    await expect(ctx.prisma.$executeRawUnsafe("UPDATE auditoria SET accion='X'")).rejects.toThrow(/solo inserci/i);
    await expect(ctx.prisma.$executeRawUnsafe('DELETE FROM auditoria')).rejects.toThrow(/solo inserci/i);
  });
  it('CHECK: estatura fuera de rango y fechas incoherentes se rechazan aunque se evite la API', async () => {
    const base = `INSERT INTO ciudadano (identificacion,nombres,apellidos,fecha_nacimiento,lugar_nacimiento,fecha_expedicion,lugar_expedicion,rh,grupo_sanguineo,estatura_cm,actualizado_en) VALUES`;
    await expect(ctx.prisma.$executeRawUnsafe(`${base} ('1234567','A','B','1990-01-01','x','2008-01-01','x','POSITIVO','A',10,now())`)).rejects.toThrow();
    await expect(ctx.prisma.$executeRawUnsafe(`${base} ('1234568','A','B','1990-01-01','x','1980-01-01','x','POSITIVO','A',170,now())`)).rejects.toThrow();
    await expect(ctx.prisma.$executeRawUnsafe(`${base} ('abc','A','B','1990-01-01','x','2008-01-01','x','POSITIVO','A',170,now())`)).rejects.toThrow();
  });
  it('FK compuesta: el rango debe pertenecer a la fuerza del usuario', async () => {
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    const policia = await ctx.prisma.fuerzaPublica.findUnique({ where: { nombre: 'Policía' } });
    const rangoArmada = await ctx.prisma.rango.findFirst({ where: { nombre: 'Almirante' } });
    await expect(
      ctx.prisma.usuario.create({
        data: { identificacion: '8000001', nombres: 'A', apellidos: 'B', correo: 'a@example.test', rolId: rol.id, fuerzaPublicaId: policia.id, rangoId: rangoArmada.id, idFuerza: 'X-1', passwordHash: 'x' },
      }),
    ).rejects.toThrow();
  });
  it('índice único parcial: solo una solicitud pendiente por identificación', async () => {
    const policia = await ctx.prisma.fuerzaPublica.findUnique({ where: { nombre: 'Policía' } });
    const rango = await ctx.prisma.rango.findFirst({ where: { fuerzaPublicaId: policia.id } });
    const data = { identificacion: '8000002', nombres: 'A', apellidos: 'B', correo: 'b@example.test', fuerzaPublicaId: policia.id, rangoId: rango.id, idFuerza: 'P-1', resultadoValidacion: 'NO_ENCONTRADO' };
    await ctx.prisma.solicitud.create({ data: { ...data, estado: 'PENDIENTE_REVISION' } });
    await expect(ctx.prisma.solicitud.create({ data: { ...data, estado: 'PENDIENTE_REVISION' } })).rejects.toThrow();
    await ctx.prisma.solicitud.create({ data: { ...data, estado: 'RECHAZADA' } }); // histórico permitido
  });
  it('el correo se guarda en minúsculas (CHECK)', async () => {
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'ADMINISTRADOR' } });
    await expect(
      ctx.prisma.usuario.create({ data: { identificacion: '8000003', nombres: 'A', apellidos: 'B', correo: 'MAYUS@EXAMPLE.TEST', rolId: rol.id, passwordHash: 'x' } }),
    ).rejects.toThrow();
  });
});

describe('integridad de la tabla consulta (Sprint 2)', () => {
  const nueva = async (extra = {}) => {
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'ADMINISTRADOR' } });
    const u = await ctx.prisma.usuario.upsert({
      where: { identificacion: '8100001' }, update: {},
      create: { identificacion: '8100001', nombres: 'A', apellidos: 'B', correo: 'consulta-db@example.test', rolId: rol.id, passwordHash: 'x' },
    });
    const c = await ctx.prisma.ciudadano.findFirst();
    return { u, c, data: { usuarioId: u.id, ciudadanoId: c.id, identificacionConsultada: '1234567', resultado: 'REQUERIDO', origen: 'MANUAL', ...extra } };
  };
  it('es de solo inserción: UPDATE y DELETE fallan', async () => {
    const { data } = await nueva();
    await ctx.prisma.consulta.create({ data });
    await expect(ctx.prisma.$executeRawUnsafe("UPDATE consulta SET resultado='NO_REQUERIDO'")).rejects.toThrow(/solo inserci/i);
    await expect(ctx.prisma.$executeRawUnsafe('DELETE FROM consulta')).rejects.toThrow(/solo inserci/i);
  });
  it('CHECK de coherencia: NO_ENCONTRADO exige ciudadano nulo y viceversa', async () => {
    const { data } = await nueva();
    await expect(ctx.prisma.consulta.create({ data: { ...data, resultado: 'NO_ENCONTRADO' } })).rejects.toThrow();
    await expect(ctx.prisma.consulta.create({ data: { ...data, ciudadanoId: null } })).rejects.toThrow();
    await ctx.prisma.consulta.create({ data: { ...data, ciudadanoId: null, resultado: 'NO_ENCONTRADO' } });
  });
  it('CHECK de formato: la identificación consultada debe ser de 6 a 10 dígitos', async () => {
    const { data } = await nueva();
    await expect(ctx.prisma.consulta.create({ data: { ...data, identificacionConsultada: '12ab' } })).rejects.toThrow();
  });
});
