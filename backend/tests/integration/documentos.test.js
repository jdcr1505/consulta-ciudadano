import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, tokenAdmin, tokenFuncionario } from '../helpers/ctx.js';
import { construirTD1 } from '../helpers/mrz.js';

let png; let b64;
const mrz = (ctx, body, t) => ctx.api().post('/api/v1/documentos/mrz').set(auth(t)).send(body);

/** OCR falso: devuelve un texto distinto por variante, para probar la lógica sin depender del motor real. */
const ocrFalso = (porVariante) => ({ leerTexto: async (_b, variante) => porVariante[variante] ?? '' });

beforeAll(async () => {
  png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer();
  b64 = png.toString('base64');
});

describe('[HU04] lectura de la MRZ de la cédula digital', () => {
  it('devuelve la identificación cuando los dígitos de control son válidos', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: construirTD1('1012345678').join('\n') }) });
    const t = await tokenFuncionario(ctx);
    const r = await mrz(ctx, { imagen: b64 }, t);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ valido: true, identificacion: '1012345678', confianza: 'alta', intentos: 1 });
    await ctx.prisma.$disconnect();
  });
  it('prueba otras variantes de la imagen si la primera no sirve', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: 'ruido', inferior: construirTD1('79123456').join('\n') }) });
    const t = await tokenFuncionario(ctx);
    const r = await mrz(ctx, { imagen: `data:image/png;base64,${b64}` }, t);
    expect(r.body).toMatchObject({ valido: true, identificacion: '79123456', intentos: 2 });
    await ctx.prisma.$disconnect();
  });
  it('si los dígitos de control no cuadran NO entrega un número y devuelve solo la huella', async () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    const mala = [l1, l2.slice(0, 6) + String((Number(l2[6]) + 1) % 10) + l2.slice(7), l3].join('\n');
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: mala, inferior: mala, umbral: mala }) });
    const t = await tokenFuncionario(ctx);
    const r = await mrz(ctx, { imagen: b64 }, t);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ valido: false, motivo: 'DIGITO_CONTROL_INVALIDO', intentos: 3 });
    expect(r.body.identificacion).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/1012345|PEREZ|JUAN/);
    expect(r.body.huella.join('')).toMatch(/^[9A<]+$/);
    await ctx.prisma.$disconnect();
  });
  it('confianza media: dos variantes que coinciden en el número lo confirman por consenso', async () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    const lineaMala = [l1.replace('123456789', '12X45B789'), l2, l3].join('\n'); // línea 1 ilegible, fechas correctas
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: lineaMala, inferior: lineaMala }) });
    const t = await tokenFuncionario(ctx);
    const r = await mrz(ctx, { imagen: b64 }, t);
    expect(r.body).toMatchObject({ valido: true, identificacion: '1012345678', confianza: 'alta', metodo: 'consenso', intentos: 2 });
    await ctx.prisma.$disconnect();
  });
  it('confianza media sin consenso: se entrega marcada como "media" para verificarla con cuidado', async () => {
    const [l1, , l3] = construirTD1('1012345678');
    const con = (cedula) => { const x = construirTD1(cedula); return [l1.replace('123456789', '12X45B789'), x[1], l3].join('\n'); };
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: con('1012345678'), inferior: con('1012345679'), umbral: con('1012345670') }) });
    const t = await tokenFuncionario(ctx);
    const r = await mrz(ctx, { imagen: b64 }, t);
    expect(r.body).toMatchObject({ valido: true, confianza: 'media', metodo: 'linea2_fechas', intentos: 3 });
    await ctx.prisma.$disconnect();
  });
  it('sin MRZ en la imagen → MRZ_NO_ENCONTRADA', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({}) });
    const t = await tokenFuncionario(ctx);
    expect((await mrz(ctx, { imagen: b64 }, t)).body).toMatchObject({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    await ctx.prisma.$disconnect();
  });
  it('rechaza archivos que no son imágenes JPEG/PNG o están vacíos (400 IMAGEN_INVALIDA)', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({}) });
    const t = await tokenFuncionario(ctx);
    const texto = Buffer.from('esto no es una imagen '.repeat(20)).toString('base64');
    expect((await mrz(ctx, { imagen: texto }, t)).body.error.code).toBe('IMAGEN_INVALIDA');
    expect((await mrz(ctx, {}, t)).body.error.code).toBe('VALIDACION');
    await ctx.prisma.$disconnect();
  });
  it('no audita el contenido: solo método, intentos y resultado', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({ completa: construirTD1('1012345678').join('\n') }) });
    const t = await tokenFuncionario(ctx);
    await mrz(ctx, { imagen: b64 }, t);
    const a = await ctx.prisma.auditoria.findFirst({ where: { accion: 'LECTURA_MRZ' } });
    expect(JSON.stringify(a.detalle)).not.toContain('1012345678');
    expect(a.detalle).toMatchObject({ metodo: 'linea2_compuesto', confianza: 'alta' });
    await ctx.prisma.$disconnect();
  });
  it('exige sesión y permiso de consulta', async () => {
    const ctx = await crearContexto({ ocr: ocrFalso({}) });
    expect((await ctx.api().post('/api/v1/documentos/mrz').send({ imagen: b64 })).status).toBe(401);
    const perm = await ctx.prisma.permiso.findUnique({ where: { codigo: 'consultas:crear' } });
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    const t = await tokenFuncionario(ctx);
    await ctx.prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: rol.id, permisoId: perm.id } } });
    expect((await mrz(ctx, { imagen: b64 }, t)).body.error.code).toBe('CONSULTA_NO_AUTORIZADA');
    await ctx.prisma.$disconnect();
  });
  it('sin motor de OCR configurado responde OCR_NO_DISPONIBLE', async () => {
    const ctx = await crearContexto({ ocr: null });
    const t = await tokenFuncionario(ctx);
    expect((await mrz(ctx, { imagen: b64 }, t)).body.error.code).toBe('OCR_NO_DISPONIBLE');
    await ctx.prisma.$disconnect();
  });
});

// Prueba con el motor Tesseract REAL sobre una imagen SINTÉTICA (opt-in: OCR_REAL=1). No equivale a una cédula real.
describe.skipIf(!process.env.OCR_REAL)('[HU04] OCR real sobre imagen sintética', () => {
  it('lee la MRZ de una imagen generada y valida los dígitos de control', async () => {
    const { TesseractMrzOcr } = await import('../../src/integrations/ocr/TesseractMrzOcr.js');
    const ocr = new TesseractMrzOcr();
    const ctx = await crearContexto({ ocr });
    const t = await tokenFuncionario(ctx);
    const lineas = construirTD1('1012345678');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320"><rect width="100%" height="100%" fill="white"/>` +
      lineas.map((l, i) => `<text x="30" y="${90 + i * 90}" font-family="DejaVu Sans Mono, monospace" font-size="56" fill="black" textLength="1140" lengthAdjust="spacing" xml:space="preserve">${l.replace(/</g, '&lt;')}</text>`).join('') + '</svg>';
    const imagen = (await sharp(Buffer.from(svg)).jpeg().toBuffer()).toString('base64');
    const r = await mrz(ctx, { imagen }, t);
    expect(r.body).toMatchObject({ valido: true, identificacion: '1012345678' });
    await ocr.cerrar();
    await ctx.prisma.$disconnect();
  }, 60_000);
});