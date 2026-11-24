import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, paginasDePdf, textoDePdf, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';

let ctx; let admin; let func;
const pdf = (qs = '', t = admin) => ctx.api().get(`/api/v1/reportes/ciudadanos/pdf${qs}`).set(auth(t)).buffer(true).parse((res, cb) => {
  const trozos = []; res.on('data', (c) => trozos.push(c)); res.on('end', () => cb(null, Buffer.concat(trozos)));
});

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  func = await tokenFuncionario(ctx);
});

describe('[HU17] generar reporte PDF', () => {
  it('devuelve un PDF descargable con el nombre y las cabeceras correctas', async () => {
    const r = await pdf();
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="reporte-ciudadanos-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(r.body.length).toBeGreaterThan(1000);
  });
  it('incluye encabezado, fecha de generación, quién lo generó, filtros y total', async () => {
    const t = textoDePdf((await pdf()).body);
    expect(t).toContain('Registraduría Konrad Lorenz');
    expect(t).toContain('Reporte de ciudadanos');
    expect(t).toMatch(/Fecha de generación: .+/);
    expect(t).toContain('Generado por: Administrador Del Sistema');
    expect(t).toContain('Filtro de estado: Todos los ciudadanos');
    expect(t).toContain('Total de ciudadanos en el reporte: 8');
    expect(t).toContain('Página 1 de 1');
    expect(t).toContain('Sistema académico con datos ficticios');
  });
  it('lista identificación, nombres y apellidos (con tildes y ñ) de los ciudadanos', async () => {
    const t = textoDePdf((await pdf()).body);
    for (const esperado of ['Identificación', 'Nombres', 'Apellidos', '79123456', 'Jorge Enrique', 'Castaño Lara', 'Díaz Camacho', '00123456']) expect(t).toContain(esperado);
    expect(t).not.toContain('Resultado'); // no se pidió esa columna
  });
  it.each([['REQUERIDO', 3, 'Solo requeridos', ['Castaño Lara', 'Gómez Ríos', 'Ruiz Vega'], 'Rojas Pineda'], ['NO_REQUERIDO', 5, 'Solo no requeridos', ['Rojas Pineda', 'Cruz Moreno'], 'Castaño Lara']])('filtra por estado %s', async (estado, total, etiqueta, presentes, ausente) => {
    const t = textoDePdf((await pdf(`?estado=${estado}`)).body);
    expect(t).toContain(`Filtro de estado: ${etiqueta}`);
    expect(t).toContain(`Total de ciudadanos en el reporte: ${total}`);
    presentes.forEach((p) => expect(t).toContain(p));
    expect(t).not.toContain(ausente);
  });
  it('agrega las columnas opcionales Resultado y Última consulta', async () => {
    await ctx.api().post('/api/v1/consultas').set(auth(func)).send({ identificacion: '79123456' });
    const t = textoDePdf((await pdf('?columnas=resultado,ultimaConsulta')).body);
    expect(t).toContain('Resultado');
    expect(t).toContain('Última consulta');
    expect(t).toContain('Requerido');
    expect(t).toContain('No requerido');
    expect(t).toContain('Nunca');
  });
  it('excluye a los ciudadanos desactivados', async () => {
    await ctx.prisma.ciudadano.update({ where: { identificacion: '79123456' }, data: { activo: false } });
    const t = textoDePdf((await pdf()).body);
    expect(t).not.toContain('Castaño Lara');
    expect(t).toContain('Total de ciudadanos en el reporte: 7');
    await ctx.prisma.ciudadano.update({ where: { identificacion: '79123456' }, data: { activo: true } });
  });
  it('con muchos ciudadanos pagina, repite el encabezado de la tabla y numera las páginas', async () => {
    const base = await ctx.prisma.ciudadano.findUnique({ where: { identificacion: '52000111' } });
    const { id, creadoEn, actualizadoEn, ...molde } = base;
    for (let i = 0; i < 120; i++) await ctx.prisma.ciudadano.create({ data: { ...molde, identificacion: String(2000000 + i), nombres: 'Masivo', apellidos: `Prueba ${String(i).padStart(3, '0')}` } });
    const r = await pdf();
    const t = textoDePdf(r.body);
    expect(paginasDePdf(r.body)).toBeGreaterThan(2);
    const n = paginasDePdf(r.body);
    expect(t).toContain(`Página 1 de ${n}`);
    expect(t).toContain(`Página ${n} de ${n}`);
    expect(t.match(/Identificación/g).length).toBe(n); // encabezado de la tabla en cada página
    expect(t).toContain('Total de ciudadanos en el reporte: 128');
    await ctx.prisma.ciudadano.deleteMany({ where: { nombres: 'Masivo' } });
  });
  it('un reporte sin resultados lo indica claramente', async () => {
    await ctx.prisma.ciudadano.updateMany({ data: { estadoJudicial: 'NO_REQUERIDO' } });
    const t = textoDePdf((await pdf('?estado=REQUERIDO')).body);
    expect(t).toContain('No hay ciudadanos que cumplan los criterios seleccionados.');
  });
  it('valida los criterios igual que la vista previa', async () => {
    expect((await pdf('?estado=OTRO')).status).toBe(400);
    expect((await pdf('?columnas=fechaNacimiento')).status).toBe(400);
  });
  it('control de acceso: sin sesión 401 y funcionario 403; cada descarga queda auditada', async () => {
    expect((await ctx.api().get('/api/v1/reportes/ciudadanos/pdf')).status).toBe(401);
    expect((await pdf('', func)).status).toBe(403);
    expect(await ctx.prisma.auditoria.count({ where: { accion: 'REPORTE_PDF' } })).toBeGreaterThan(3);
  });
});