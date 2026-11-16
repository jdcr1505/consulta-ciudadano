import { describe, expect, it } from 'vitest';
import { cumplePolitica, generarPasswordTemporal, hashPassword, verifyPassword } from '../../src/security/password.js';

describe('[HU02] generación de contraseña temporal', () => {
  it('genera siempre 6 caracteres con mayúscula, minúscula y número (1000 muestras)', () => {
    for (let i = 0; i < 1000; i++) {
      const p = generarPasswordTemporal();
      expect(p).toHaveLength(6);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(cumplePolitica(p)).toBe(true);
    }
  });
  it('no repite valores de forma evidente', () => {
    const s = new Set(Array.from({ length: 200 }, generarPasswordTemporal));
    expect(s.size).toBeGreaterThan(190);
  });
});

describe('[HU03][HU02] política de contraseña', () => {
  it.each([
    ['Abc123', true],
    ['abc123', false],
    ['ABC123', false],
    ['Abcdef', false],
    ['Ab1', false],
    ['', false],
    [null, false],
    ['A1' + 'b'.repeat(70), false],
  ])('cumplePolitica(%s) = %s', (pwd, esperado) => {
    expect(cumplePolitica(pwd)).toBe(esperado);
  });
});

describe('hashing de contraseñas', () => {
  it('usa Argon2id, no guarda texto plano y verifica correctamente', async () => {
    const hash = await hashPassword('Abc123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Abc123');
    expect(await verifyPassword(hash, 'Abc123')).toBe(true);
    expect(await verifyPassword(hash, 'Abc124')).toBe(false);
    expect(await verifyPassword('no-es-un-hash', 'Abc123')).toBe(false);
  });
  it('produce hashes distintos para la misma contraseña (sal única)', async () => {
    expect(await hashPassword('Abc123')).not.toBe(await hashPassword('Abc123'));
  });
});
