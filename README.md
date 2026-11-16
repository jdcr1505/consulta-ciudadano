# Sistema de Consulta Ciudadano — Registraduría Konrad Lorenz

Proyecto académico (Ingeniería de Software 1). **Todos los datos son ficticios** y las integraciones externas
(Departamento de Defensa y correo) están **simuladas** y claramente identificadas en la interfaz.

**Estado: Entrega 2 (Sprint 2)** — Sprint 1: HU01, HU02, HU03, HU12, HU13, HU14 (`docs/ENTREGA-1.md`). Sprint 2: HU04, HU05, HU06 y HU16, lectura de cédula amarilla (PDF417) y digital (MRZ) y rediseño visual (`docs/ENTREGA-2.md`).

## Componentes

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API REST y reglas de negocio (única puerta de acceso a la BD) | Node.js 22 + Express 5, Prisma, PostgreSQL |
| `web/` | Aplicación web administrativa | React 19 + Vite |
| `mobile/` | App móvil Android para la fuerza pública | React Native + Expo SDK 58 |
| `database/` | Script SQL del esquema y datos de demostración | PostgreSQL |
| `docs/` | Documentación | Markdown |

La web y el móvil consumen **la misma API**; ninguno toca la base de datos.

## Requisitos
Node.js 22 o superior, PostgreSQL 14+ (o Docker), y para el móvil Android Studio (emulador) o Expo Go en un teléfono.

## 1. Base de datos
```bash
docker compose up -d        # o use su PostgreSQL y cree la BD y el usuario de .env.example
```

## 2. Backend
```bash
cd backend
cp .env.example .env        # y cambie JWT_ACCESS_SECRET por un valor propio
npm install
npm run prisma:generate
npm run db:migrate          # alternativa sin Prisma: psql -f ../database/schema.sql (y seed_demo.sql)
npm run db:seed             # catálogos, roles, permisos, administrador inicial y datos ficticios
npm run dev                 # http://localhost:4000/api/v1
npm test                    # ver «Pruebas» más abajo
OCR_REAL=1 npm test         # (opcional) incluye la prueba con el motor OCR real
```
Primer administrador: identificación `1000000001`, contraseña `Admin1` (definida en `.env`). **Debe cambiarla en el primer ingreso.**

**Lectura de MRZ (OCR):** usa `tesseract.js` y `sharp`, que se instalan con `npm install` (descargan binarios de npm). El motor arranca solo al primer uso y guarda su caché en `backend/.ocr-cache`.

**Pruebas:** usan una BD aparte cuyo nombre termina en `_test` (por defecto `consulta_ciudadano_test`; se puede
indicar otra con `TEST_DATABASE_URL`). Las pruebas **la crean solas si no existe**, aplican el esquema y la reinician
en cada archivo; por eso nunca tocan su base de desarrollo. El usuario de PostgreSQL necesita permiso `CREATEDB`
(el del `docker-compose.yml` ya lo tiene). Si no lo tiene, cree la BD vacía a mano:
`psql -U <usuario> -d postgres -c "CREATE DATABASE consulta_ciudadano_test"`.

## 3. Web
```bash
cd web
npm install
npm run dev                 # http://localhost:5173  (reenvía /api al backend)
npm test
```

## 4. Móvil (Android)
```bash
cd mobile
npm install
# Emulador Android: funciona por defecto (http://10.0.2.2:4000).
# Teléfono físico: use la IP de su computador:
#   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
npx expo start --android
npm test                    # pruebas de validación (sin emulador)
```
**APK:** no se generó en esta entrega. Opciones: `eas build -p android --profile preview` (requiere cuenta Expo) o
`npx expo prebuild -p android` + `./gradlew assembleRelease` (requiere Android SDK). Un APK de producción que hable con
una API por `http://` necesita permitir tráfico en claro; en producción use HTTPS.

## Flujo de demostración
1. Web → ingrese como administrador → cambie la contraseña → explore Ciudadanos, Usuarios y Roles.
2. Móvil → **Solicitar acceso** con un registro ficticio de la fuente simulada de Defensa:

| Identificación | Nombres y apellidos | Fuerza · Rango | ID Fuerza |
|---|---|---|---|
| 1020304050 | Carlos Andrés Vargas Mejía | Policía · Intendente | PN-48213 |
| 1030405060 | Laura Sofía Ramírez Duque | Ejército · Capitán | EJ-77120 |
| 1040506070 | Julián David Torres Peña | Armada · Teniente de Corbeta | AR-30955 |
| 1050607080 | Diana Marcela Ortiz León | Fuerza Aérea · Teniente | FA-20418 |

   Cualquier dato que no coincida (o la identificación `9999999999`, que simula la caída del servicio) deja la
   solicitud **pendiente de revisión** y no otorga acceso.
3. El correo es **simulado**: la contraseña temporal queda en `backend/dev-outbox/*.json` y en
   `GET /api/v1/dev/outbox` (solo con `MAIL_MODE=dev`, que el sistema prohíbe en producción).
4. Ingrese en el móvil con esa contraseña temporal → el sistema obliga a cambiarla.
5. **Consulta (Sprint 2):** en el móvil, *Consultar un ciudadano* → elija **Escribir el número** y pruebe con los ciudadanos ficticios:
   `79123456` y `80987654` o `1022334455` → **Requerido**; `52000111` o `1012345678` → **No requerido**; `9000000009` → **Sin registro**.
   Para probar los errores, apague el backend y consulte: debe decir «Sin conexión», nunca «No requerido».
6. **Cédulas reales:** *Cédula amarilla* (código de barras) y *Cédula digital* (foto de la zona MRZ). El **Diagnóstico del lector** muestra la forma de lo leído sin revelar datos. Ver `docs/ENTREGA-2.md` §3 sobre lo que está y no está verificado.
7. **Reportes (HU16):** en la web, *Reportes* → elija estado y columnas → vista previa (el PDF llega en el Sprint 3).

## Seguridad (resumen)
Argon2id para contraseñas · JWT de acceso de 15 min + refresh token opaco rotado y guardado como hash · bloqueo por
intentos fallidos · autorización por permiso en el servidor · validación con Zod · CORS restringido · `helmet` ·
auditoría sin datos sensibles · secretos solo en variables de entorno. Detalles y limitaciones en `docs/ENTREGA-1.md`.
