import argon2 from 'argon2';
import { randomInt } from 'node:crypto';

// Política académica (enunciado, HU02 y CA08): 6 o más caracteres con mayúscula, minúscula y número.
export const MIN_LENGTH = 6;
export const MAX_LENGTH = 64;

export function cumplePolitica(pwd) {
  return (
    typeof pwd === 'string' &&
    pwd.length >= MIN_LENGTH &&
    pwd.length <= MAX_LENGTH &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd)
  );
}

export const MENSAJE_POLITICA =
  'La contraseña debe tener entre 6 y 64 caracteres, con al menos una mayúscula, una minúscula y un número';

const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I y O para evitar confusiones al transcribir
const MINUS = 'abcdefghijkmnpqrstuvwxyz'; // sin l y o
const NUMS = '23456789'; // sin 0 y 1
const TODOS = MAYUS + MINUS + NUMS;

const pick = (set) => set[randomInt(set.length)];

// Contraseña temporal de exactamente 6 caracteres con CSPRNG (crypto.randomInt) y mezcla Fisher-Yates.
export function generarPasswordTemporal() {
  const chars = [pick(MAYUS), pick(MINUS), pick(NUMS)];
  while (chars.length < 6) chars.push(pick(TODOS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Argon2id con parámetros recomendados por OWASP (m>=19 MiB, t>=2, p=1).
const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pwd) => argon2.hash(pwd, OPTS);

export async function verifyPassword(hash, pwd) {
  try {
    return await argon2.verify(hash, pwd);
  } catch {
    return false;
  }
}

// Verificación ficticia para igualar tiempos cuando el usuario no existe (evita enumeración por temporización).
let dummy;
export async function dummyVerify(pwd) {
  dummy ??= await hashPassword('Dummy1Password');
  await verifyPassword(dummy, pwd);
}
