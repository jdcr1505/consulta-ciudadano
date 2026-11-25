# Sistema de Consulta Ciudadano — Registraduría Konrad Lorenz

Proyecto académico (Ingeniería de Software 1). **Todos los datos son ficticios** y las integraciones externas
(Departamento de Defensa) están **simuladas** y claramente identificadas en la interfaz.

**Estado: Entrega Final (Sprint 3 — Desplegado en producción)**
- **Sprint 1:** HU01, HU02, HU03, HU12, HU13, HU14 (`docs/ENTREGA-1.md`).
- **Sprint 2:** HU04, HU05, HU06, HU16, lectura de cédula amarilla (PDF417) y digital (MRZ), y rediseño visual (`docs/ENTREGA-2.md`).
- **Sprint 3:** HU07 (historial de consultas), HU08–HU09 y HU15 (gestión e historial de novedades), HU10–HU11 (revisión y aprobación/rechazo de solicitudes), HU17 (exportación de reportes en PDF) y despliegue integral (`docs/ENTREGA-3.md`).

## Entorno desplegado (Producción)

| Componente | Servicio / Plataforma | Acceso |
|---|---|---|
| **Web + API REST** | Render (contenedor Docker, región Ohio `us-east-2`) | `https://consulta-ciudadano.onrender.com` |
| **Health Check API** | Render / Express | `https://consulta-ciudadano.onrender.com/api/v1/health` |
| **Base de datos** | Neon PostgreSQL (`us-east-2`) | Gestionada por Prisma (`DATABASE_URL` + `DIRECT_URL`) |
| **App Móvil (Android)** | Expo EAS Build (`@jdcr1505/consulta-ciudadano`) | `.apk` compilado con perfil `production` apuntando a Render |
| **Correo transaccional** | SMTP real (`smtp.gmail.com`) | Envío de contraseñas temporales y notificaciones en producción |

> **Nota sobre instancias gratuitas:** El servicio web en Render se suspende tras ~15 minutos sin tráfico; la primera petición después de una pausa tarda entre 30 y 50 segundos mientras reactiva el contenedor y la base de datos en Neon.

## Componentes

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API REST y reglas de negocio (única puerta de acceso a la BD) | Node.js 22 + Express 5, Prisma, PostgreSQL |
| `web/` | Aplicación web administrativa | React 19 + Vite |
| `mobile/` | App móvil Android para la fuerza pública | React Native + Expo SDK 58 |
| `database/` | Script SQL del esquema y datos de demostración | PostgreSQL |
| `scripts/` | Utilidades: `setup`, `doctor`, `dev:movil`, firewall | Node.js |
| `docs/` | Documentación técnica y bitácoras de entrega | Markdown |

La web y el móvil consumen **la misma API**; ninguno toca la base de datos directamente.

## Requisitos (desarrollo local)
Node.js **22.9 o superior** y una base de datos PostgreSQL: **Neon** (recomendado, ver `docs/DESPLIEGUE.md`) o Docker Desktop para una base local. Para pruebas locales del móvil, un teléfono Android con Expo Go o el `.apk` compilado.

## Inicio rápido local (3 comandos)
```bash
npm run setup      # instala todo, crea backend/.env, prepara la base (levanta Docker si es local), migra y siembra datos
npm run dev        # API + web en UNA sola terminal  →  http://localhost:5173
npm run dev:movil  # app móvil: detecta sola la IP de su red (no hay que escribirla)
```
Atajos: `npm run dev:todo` (API + web + móvil a la vez), `npm run doctor` (diagnostica base de datos, red, firewall y configuración), `npm test` (todas las pruebas), `npm run db:up` / `db:down` (Docker).

Primer administrador local: identificación `1000000001`, contraseña `Admin1` (definida en `backend/.env`). **Debe cambiarla en el primer ingreso.**

### ¿La base de datos local se apaga?
Con Docker: active *Start Docker Desktop when you sign in* en la configuración de Docker Desktop; el `docker-compose.yml` ya usa `restart: unless-stopped`. Con Neon no hay nada que levantar localmente. Si algo falla, `npm run doctor` indica la causa.

### Teléfono físico sin IP manual
`npm run dev:movil` elige la IP de su Wi-Fi/Ethernet automáticamente (ignora los adaptadores virtuales de Docker/WSL). Si el teléfono no conecta en red local, ejecute en PowerShell **como administrador** `powershell -File scripts/firewall-windows.ps1`. Para probar contra producción sin depender de la red local, instale el `.apk` de EAS Build o use `npm run dev:movil -- --url https://consulta-ciudadano.onrender.com`.

### Comandos individuales
| Qué | Comando |
|---|---|
| Solo el backend | `npm --prefix backend run dev` |
| Solo la web | `npm --prefix web run dev` |
| Migraciones / datos | `npm --prefix backend run db:migrate` · `db:seed` |
| Web compilada servida por el backend (como en producción) | `npm start` |
| Pruebas del backend con el OCR real | `OCR_REAL=1 npm --prefix backend test` |

**Pruebas:** usan una BD aparte cuyo nombre termina en `_test` (por defecto `consulta_ciudadano_test`; otra con `TEST_DATABASE_URL`). Se **crea sola** si no existe y se recrea desde cero en cada archivo; nunca toca su base de desarrollo ni producción.

**Lectura de MRZ (OCR):** usa `tesseract.js` y `sharp` (se instalan con `npm install`). El motor arranca al primer uso y guarda su caché en `backend/.ocr-cache`.

**APK de Android:** configurado en `mobile/eas.json` (`buildType: "apk"`). Compilado y verificado mediante Expo EAS Build (`docs/DESPLIEGUE.md`).

## Flujo de demostración
1. **Web (`https://consulta-ciudadano.onrender.com`):** ingrese como administrador → cambie la contraseña si es primer ingreso → explore Ciudadanos, Usuarios y Roles.
2. **Móvil (APK):** **Solicitar acceso** con un registro ficticio de la fuente simulada de Defensa:

| Identificación | Nombres y apellidos | Fuerza · Rango | ID Fuerza |
|---|---|---|---|
| 1020304050 | Carlos Andrés Vargas Mejía | Policía · Intendente | PN-48213 |
| 1030405060 | Laura Sofía Ramírez Duque | Ejército · Capitán | EJ-77120 |
| 1040506070 | Julián David Torres Peña | Armada · Teniente de Corbeta | AR-30955 |
| 1050607080 | Diana Marcela Ortiz León | Fuerza Aérea · Teniente | FA-20418 |

   Cualquier dato que no coincida (o la identificación `9999999999`, que simula la caída del servicio) deja la solicitud **pendiente de revisión** (HU10/HU11) y no otorga acceso hasta que un administrador la apruebe en la web.
3. **Credenciales por correo:** en producción (`MAIL_MODE=smtp`), la contraseña temporal llega al correo real registrado; en desarrollo (`MAIL_MODE=dev`), queda en `backend/dev-outbox/*.json` y en `GET /api/v1/dev/outbox`.
4. **Primer ingreso móvil:** ingrese con la contraseña temporal → el sistema obliga a cambiarla.
5. **Consulta (HU04–HU06):** en el móvil, *Consultar un ciudadano* → elija **Escribir el número** y pruebe con los ciudadanos ficticios:
   `79123456`, `80987654` o `1022334455` → **Requerido**; `52000111` o `1012345678` → **No requerido**; cualquier número que **no figure en el sistema** (p. ej. `9000000009`) → **No requerido** (con la nota «no figura en el sistema»).
6. **Cédulas reales:** *Cédula amarilla* (código de barras PDF417) y *Cédula digital* (foto de la zona MRZ). El **Diagnóstico del lector** muestra la forma de lo leído sin revelar datos.
7. **Historial y Novedades (HU07, HU08–HU09, HU15):** consulte el historial de verificaciones realizadas y registre/gestione novedades judiciales sobre los ciudadanos.
8. **Reportes y PDF (HU16–HU17):** en la web, *Reportes* → filtre por estado y seleccione columnas → vista previa y descarga del reporte en formato **PDF**.

## Seguridad (resumen)
Argon2id para contraseñas · JWT de acceso de 15 min + refresh token opaco rotado y guardado como hash · bloqueo por intentos fallidos · autorización por permiso en el servidor · validación con Zod · CORS restringido · `helmet` · auditoría sin datos sensibles · secretos solo en variables de entorno. Detalles en `docs/ENTREGA-1.md` y `docs/ENTREGA-3.md`.