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
| `scripts/` | Utilidades: `setup`, `doctor`, `dev:movil`, firewall | Node.js |
| `docs/` | Documentación | Markdown |

La web y el móvil consumen **la misma API**; ninguno toca la base de datos.

## Requisitos
Node.js **22.9 o superior** y una base de datos PostgreSQL: **Neon** (recomendado, ver `docs/DESPLIEGUE.md`) o Docker Desktop para una base local. Para el móvil, un teléfono Android con la app Expo Go.

## Inicio rápido (3 comandos)
```bash
npm run setup      # instala todo, crea backend/.env, prepara la base (levanta Docker si es local), migra y siembra datos
npm run dev        # API + web en UNA sola terminal  →  http://localhost:5173
npm run dev:movil  # app móvil: detecta sola la IP de su red (no hay que escribirla)
```
Atajos: `npm run dev:todo` (API + web + móvil a la vez), `npm run doctor` (diagnostica base de datos, red, firewall y configuración y dice qué hacer), `npm test` (todas las pruebas), `npm run db:up` / `db:down` (Docker).

Primer administrador: identificación `1000000001`, contraseña `Admin1` (definida en `backend/.env`). **Debe cambiarla en el primer ingreso.**

### ¿La base de datos se apaga?
Con Docker: active *Start Docker Desktop when you sign in* en la configuración de Docker Desktop; el `docker-compose.yml` ya usa `restart: unless-stopped`, así que el contenedor vuelve solo. Con Neon no hay nada que levantar. Si algo falla, `npm run doctor` indica la causa.

### Teléfono físico sin IP manual
`npm run dev:movil` elige la IP de su Wi-Fi/Ethernet automáticamente (ignora los adaptadores virtuales de Docker/WSL). Si el teléfono no conecta, casi siempre es el Firewall de Windows: ejecute en PowerShell **como administrador** `powershell -File scripts/firewall-windows.ps1`. Para no depender de la red local, despliegue el backend y use `npm run dev:movil -- --url https://su-servidor`.

### Comandos individuales
| Qué | Comando |
|---|---|
| Solo el backend | `npm --prefix backend run dev` |
| Solo la web | `npm --prefix web run dev` |
| Migraciones / datos | `npm --prefix backend run db:migrate` · `db:seed` |
| Web compilada servida por el backend (como en producción) | `npm start` |
| Pruebas del backend con el OCR real | `OCR_REAL=1 npm --prefix backend test` |

**Pruebas:** usan una BD aparte cuyo nombre termina en `_test` (por defecto `consulta_ciudadano_test`; otra con `TEST_DATABASE_URL`). Se **crea sola** si no existe y se recrea desde cero en cada archivo; nunca toca su base de desarrollo. El usuario de PostgreSQL necesita permiso `CREATEDB`.

**Lectura de MRZ (OCR):** usa `tesseract.js` y `sharp` (se instalan con `npm install`). El motor arranca al primer uso y guarda su caché en `backend/.ocr-cache`.

**APK:** no se generó en esta entrega. Se compila con EAS (`mobile/eas.json`); ver `docs/DESPLIEGUE.md`.

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
   `79123456`, `80987654` o `1022334455` → **Requerido**; `52000111` o `1012345678` → **No requerido**; cualquier número que **no figure en el sistema** (p. ej. `9000000009`) → **No requerido** (con la nota «no figura en el sistema»).
   Para probar los errores, apague el backend y consulte: debe decir «Sin conexión», nunca «No requerido».
6. **Cédulas reales:** *Cédula amarilla* (código de barras) y *Cédula digital* (foto de la zona MRZ). El **Diagnóstico del lector** muestra la forma de lo leído sin revelar datos. Ver `docs/ENTREGA-2.md` §3 sobre lo que está y no está verificado.
7. **Reportes (HU16):** en la web, *Reportes* → elija estado y columnas → vista previa (el PDF llega en el Sprint 3).

## Seguridad (resumen)
Argon2id para contraseñas · JWT de acceso de 15 min + refresh token opaco rotado y guardado como hash · bloqueo por
intentos fallidos · autorización por permiso en el servidor · validación con Zod · CORS restringido · `helmet` ·
auditoría sin datos sensibles · secretos solo en variables de entorno. Detalles y limitaciones en `docs/ENTREGA-1.md`.
