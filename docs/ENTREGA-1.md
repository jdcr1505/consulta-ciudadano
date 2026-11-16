# Entrega 1 — Sprint 1

Historias incluidas (asignación original del Excel, sin cambios): **HU01, HU02, HU13, HU03, HU12, HU14**.

## 1. Matriz de trazabilidad (Sprint 1)

Referencias del VSM: actor, actividad y paso tal como aparecen en el mapa verificado.

| HU | Actor | Actividad › Paso (VSM) | MVP | Pantalla | Endpoints | Servicio | Entidades | Estado |
|---|---|---|---|---|---|---|---|---|
| HU01 Registrar Solicitud | Fuerza Pública (móvil) | Solicitar Acceso › Solicitar Acceso al Sistema | 1 | `mobile/src/screens/Registro.js` | `GET /catalogos/fuerzas`, `POST /solicitudes` | `solicitudes.service` | solicitud, usuario, fuerza_publica, rango, sim_defensa, auditoria | Implementada · pruebas de API superadas · UI móvil sin probar en dispositivo |
| HU02 Recibir Credenciales | Fuerza Pública (móvil) | Acceder al Sistema › Recibir Credenciales de Acceso | 1 | (correo; pantalla de resultado en `Registro.js`) | (interno de `POST /solicitudes` y `POST /usuarios`) | `auth/credenciales`, `integrations/mail` | usuario | Implementada con correo **simulado** · SMTP real sin probar |
| HU13 Gestionar Roles | Administrador (web) | Gestionar Roles › Administrar los Roles | 2 | `web/src/pages/Roles.jsx` | `GET/POST /roles`, `GET /roles/permisos`, `GET/PATCH/DELETE /roles/:id`, `PUT /roles/:id/permisos` | `roles.service`, `security/privilegios` | rol, opcion, permiso, rol_permiso | Implementada · pruebas de API y UI superadas |
| HU03 Iniciar Sesión | Fuerza Pública y Administrador | Acceder al Sistema › Iniciar Sesión en el Sistema | 1 | `web/src/pages/Login.jsx`, `CambiarPassword.jsx`; `mobile/src/screens/Login.js`, `CambiarPassword.js` | `POST /auth/login`, `/refresh`, `/logout`, `/cambiar-password`; `GET /auth/me` | `auth.service`, `security/*` | usuario, sesion, auditoria | Implementada · CA01–CA09 con evidencia automatizada (ver §4) · UI móvil sin probar en dispositivo |
| HU12 Gestionar Usuarios | Administrador (web) | Gestionar Usuarios › Administrar los Usuarios | 2 | `web/src/pages/Usuarios.jsx` | `GET/POST /usuarios`, `GET/PATCH /usuarios/:id`, `PATCH /usuarios/:id/estado`, `PATCH /usuarios/:id/rol`, `POST /usuarios/:id/restablecer-password` | `usuarios.service` | usuario, rol, fuerza_publica, rango, sesion | Implementada · pruebas de API superadas · UI probada con simulación de red |
| HU14 Gestionar Consultas Generales | Administrador (web) | Gestionar Ciudadanos › Administrar los Ciudadanos | 2 | `web/src/pages/Ciudadanos.jsx` | `GET/POST /ciudadanos`, `GET/PATCH /ciudadanos/:id`, `PATCH /ciudadanos/:id/activo` | `ciudadanos.service` | ciudadano | Implementada según la lectura de la línea base (CRUD de ciudadanos) |

*Los criterios de aceptación formales solo existen para HU03 (CA01–CA09 de la hoja «Documentación HU03»). Para las demás historias se implementó el alcance del Sprint Backlog y del enunciado.*

## 2. Referencia de la API (Sprint 1)

Base `/api/v1`. Errores: `{ "error": { "code", "message", "details": [{ "campo", "mensaje" }] } }`.
Códigos: 400 validación · 401 sin sesión o credenciales inválidas · 403 sin permiso · 404 · 409 conflicto · 429 límite de intentos · 503 servicio no disponible.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /health`, `GET /info` | público | Estado e indicación de simulaciones activas |
| `GET /catalogos/fuerzas` | público | Fuerzas con sus rangos |
| `POST /solicitudes` | público (limitado por tasa) | Registro del funcionario. `201` con `estado` `VALIDADA` o `PENDIENTE_REVISION` |
| `POST /auth/login` | público (limitado) | `{identificacion, password}` → `{accessToken, expiresIn, usuario}` (+ `refreshToken` en el cuerpo si `x-client-type: mobile`; en la web va en cookie httpOnly) |
| `POST /auth/refresh`, `POST /auth/logout` | refresh token / sesión | Rotación del refresh token; cierre de sesión |
| `POST /auth/cambiar-password` | sesión (única ruta permitida con contraseña temporal) | `{passwordActual, passwordNueva}` |
| `GET /auth/me` | sesión | Usuario y permisos |
| `GET/POST /usuarios`, `GET/PATCH /usuarios/:id` | `usuarios:leer/crear/editar` | Gestión de usuarios (identificación inmutable) |
| `PATCH /usuarios/:id/estado`, `/rol` · `POST /usuarios/:id/restablecer-password` | `usuarios:editar` | Estado, rol único y restablecimiento |
| `GET /roles`, `/roles/permisos`, `/roles/:id` | `roles:leer` | Consulta |
| `POST /roles`, `PATCH /roles/:id`, `PUT /roles/:id/permisos`, `DELETE /roles/:id` | `roles:crear/editar/eliminar` | Gestión de roles |
| `GET/POST /ciudadanos`, `GET/PATCH /ciudadanos/:id`, `PATCH /ciudadanos/:id/activo` | `ciudadanos:leer/crear/editar` | Filtros `q`, `identificacion`, `estadoJudicial`, `activo`, `page`, `pageSize` |
| `GET /dev/outbox` | solo `MAIL_MODE=dev` | Correos simulados (prohibido en producción) |

## 3. Reglas de negocio relevantes
- Solicitud **validada** → se crea el usuario `FUNCIONARIO`, se genera la contraseña temporal y se envía por correo; si el correo falla, **todo se revierte** (503).
- Solicitud **no validada** (no encontrado, datos que no coinciden o servicio caído) → `PENDIENTE_REVISION`, **sin acceso**. Una caída del servicio nunca aprueba.
- Contraseña temporal: 6 caracteres, CSPRNG, vigencia 24 h, cambio obligatorio (el resto de la API responde `403 CAMBIO_PASSWORD_REQUERIDO`).
- Login: mensaje genérico para usuario inexistente, contraseña errónea o usuario inactivo (CA09); bloqueo temporal tras `MAX_LOGIN_ATTEMPTS` (por defecto 5) durante `LOCK_MINUTES` (15).
- Un usuario tiene **un solo rol**. Anti-escalada: solo puede asignar o administrar roles cuyos permisos posee completos; no puede cambiarse su propio estado/rol; siempre debe existir un administrador activo; el rol `ADMINISTRADOR` y los roles base están protegidos.
- Ciudadanos: sin borrado físico (se desactiva); identificación inmutable y almacenada como texto (conserva ceros iniciales).

## 4. Pruebas (ejecutadas en el entorno de generación)

| Suite | Herramienta | Resultado |
|---|---|---|
| Backend: unitarias (contraseñas, política, hashing) + integración API/BD (solicitudes, auth, roles, usuarios, ciudadanos, autorización, integridad de BD) contra **PostgreSQL 16 real** | Vitest + Supertest | **143 / 143 superadas** |
| Web: validación del login, «recordar», cambio obligatorio, navegación por permisos, banda de simulación | Vitest + Testing Library (jsdom, red simulada) | **8 / 8 superadas** |
| Móvil: lógica de validación del cliente | `node --test` | **11 / 11 superadas** |
| Móvil: empaquetado Android (Metro/Hermes) | `expo export` | **Compila** (628 módulos) — no es un APK |

**Cobertura de los criterios de aceptación de HU03** (hoja «Documentación HU03»):

| CA | Criterio (resumen) | Evidencia automatizada |
|---|---|---|
| CA01 | Permitir ingresar identificación y contraseña | `app.test.jsx` (campos del formulario por etiqueta); pantalla móvil `Login.js` (sin probar en dispositivo) |
| CA02 | Credenciales correctas → autenticar y permitir el ingreso | `auth.test.js` «login correcto devuelve token…» |
| CA03 | Credenciales incorrectas → informar y negar el acceso | `auth.test.js` «mismo mensaje genérico…»; `app.test.jsx` |
| CA04 | Validar que ambos campos estén diligenciados antes de intentar | `auth.test.js` (400 con detalle por campo); `app.test.jsx` (no llama a la API); `validation.test.js` móvil |
| CA05 | Opción «Recordar contraseña» | `app.test.jsx` («Recordar» en la pantalla de login) |
| CA06 | Contraseña protegida con algoritmo conocido y probado | `password.test.js` (Argon2id, sal única); `solicitudes.test.js` (hash Argon2id en BD, sin texto plano); `usuarios.test.js` (la respuesta no expone hashes) |
| CA07 (supuesto) | Recordar solo la identificación; sesión con vencimiento | `app.test.jsx` (solo la identificación en el almacenamiento); `auth.test.js` (`expiresIn` = 900 s, rotación y revocación de refresh). *El vencimiento del refresh token (12 h) no tiene prueba propia.* |
| CA08 (supuesto) | Contraseña temporal → cambio obligatorio con política 6+ / mayúscula / minúscula / número | `auth.test.js` (403 `CAMBIO_PASSWORD_REQUERIDO`, política, repetida, actual incorrecta); `app.test.jsx` |
| CA09 (supuesto) | Inactivo o solicitud pendiente/rechazada no ingresa; mensaje que no revela la causa | `auth.test.js` (inactivo); `solicitudes.test.js` (pendiente sin acceso). *«Rechazada» se completa con HU11 (Sprint 3).* |

**No ejecutado / pendiente:** prueba manual en navegador real, en emulador o dispositivo Android, SMTP real, `prisma migrate` (ver §6), instalación con Docker.

## 5. Registro de supuestos de esta entrega
| # | Supuesto | Motivo |
|---|---|---|
| A1 | Identificación = 6 a 10 dígitos (texto) | Formato razonable de cédula; ajustable en `common/fields.js` y en los `CHECK` |
| A2 | Contraseña temporal vigente 24 h; bloqueo 5 intentos / 15 min | «Vigencia limitada» y protección de fuerza bruta (configurable) |
| A3 | Un usuario, un rol | Decisión del equipo |
| A4 | Identificación inmutable tras el alta (ciudadano y usuario) | Es la clave de negocio de consultas e historial |
| A5 | Estatura en centímetros (50–250) | Evita decimales ambiguos |
| A6 | Catálogo de rangos simplificado (62 rangos) | No refleja el escalafón oficial completo |
| A7 | `9999999999` simula caída del servicio de Defensa | Permite probar el error «servicio no disponible» |
| A8 | `GET /dev/outbox` en modo desarrollo | Probar el flujo sin SMTP; prohibido en producción por configuración |
| A9 | Roles protegidos: `ADMINISTRADOR` no modificable | Evita dejar el sistema sin administrador |

## 6. Limitaciones y riesgos conocidos
1. **Contraseñas por correo:** el enunciado exige enviar la contraseña por correo; el correo no es un canal seguro. Mitigaciones: 6 caracteres solo como temporal, vigencia de 24 h, cambio obligatorio, bloqueo por intentos, hash Argon2id, no se registra en logs ni auditoría. Una contraseña de 6 caracteres tiene poca entropía: depende del bloqueo y la vigencia.
2. **Migraciones:** en el entorno de generación el servidor de binarios de Prisma estaba bloqueado, así que `prisma migrate` **no se ejecutó**. La migración SQL (`backend/prisma/migrations/…/migration.sql`) está escrita a mano, incluye `CHECK`, índices parciales, FK compuestas y trigger que Prisma no expresa, y se **verificó aplicándola en PostgreSQL 16** y ejecutando las 143 pruebas con el cliente Prisma. Al instalar en su equipo ejecute `npm run db:migrate` y, opcionalmente, compare con `prisma migrate diff` (las diferencias esperadas son solo esas restricciones adicionales).
3. **Dependencias:** `npm audit` reporta 0 vulnerabilidades en backend y web; en móvil reporta 8 (5 bajas, 3 altas) en dependencias transitivas de las herramientas de Expo. No se forzó la actualización para no romper la compatibilidad del SDK.
4. **Tabla `sim_defensa` y correo simulado** no son integraciones reales; ver `DefensaProvider.js` para sustituirlas por una integración autorizada.
5. **Rate limiting** en memoria (una instancia). Detrás de un proxy inverso configure `trust proxy`.
6. Las tablas `consulta`, `novedad` y `novedad_historial` del modelo se crean en las migraciones de los Sprints 2 y 3.
7. **Aviso `DeprecationWarning` de `pg` al ejecutar pruebas** («Calling client.query() when the client is already executing a query»). Se origina en `@prisma/adapter-pg` (`PgTransaction.performIO`), no en el código del proyecto: Prisma lanza consultas de relaciones en paralelo sobre la misma conexión de una transacción. Hoy `pg` 8 las encola y todo funciona (143/143 también en Windows); `pg` 9 dejaría de permitirlo. Por eso `pg` queda en `^8` (no actualizar a 9 hasta que Prisma lo soporte). Revisar al actualizar Prisma.
8. Web: no probada en navegador real ni auditada con lector de pantalla (se usaron etiquetas, roles ARIA y foco visible).

## 7. Registro de defectos
| # | Hallazgo | Detección | Corrección |
|---|---|---|---|
| D1 | El middleware comparaba `req.path` relativo al router y bloqueaba la propia ruta `cambiar-password` bajo la regla de cambio obligatorio (CA08) | Pruebas de integración (51 fallos en la primera ejecución) | Comparar contra la URL completa; 143/143 tras la corrección |
| D2 | Dato de prueba ambiguo (dos usuarios llamados «Elena») | Prueba de listado | Se ajustó la aserción (no era un defecto de la aplicación) |

## 8. Decisiones pendientes para los siguientes sprints
- **HU16/HU17 (Sprint 2/3):** reporte con una fila por ciudadano y estado vigente (opción A aprobada).
- **Consulta y escáner (Sprint 2):** verificar el formato PDF417 con `expo-camera`; si no hay cédula real de prueba, se usará entrada manual y códigos ficticios, declarado como limitación.
