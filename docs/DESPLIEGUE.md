# Guía de despliegue

Arquitectura recomendada (todo accesible por HTTPS y sin escribir IP alguna):

```
Teléfono (APK) ──┐
                 ├──►  https://su-app.onrender.com  ──►  Neon (PostgreSQL)
Navegador (web) ─┘     un solo servicio: API + web
```

- **Base de datos:** Neon.
- **Backend + web:** un único servicio (el backend sirve la web compilada en el mismo origen: sin CORS y con la cookie de sesión funcionando).
- **Móvil:** APK compilado con EAS que apunta a esa URL pública (por eso ya no depende de la IP de su computador).

> **No verificado por quien generó este código:** no se desplegó nada en Neon, Render ni EAS (el entorno de desarrollo no tiene cuentas ni acceso). Sí se verificó localmente que el backend arranca en modo producción, sirve la web y la API, envía la cookie `HttpOnly; Secure; SameSite=Strict` y que todas las pruebas pasan. El `Dockerfile` no pudo construirse aquí (no hay Docker). Si algún paso falla, envíe el mensaje de error.

## 1. Base de datos en Neon

1. Cree una cuenta y un proyecto en [neon.com](https://neon.com). Elija la región más cercana.
2. En el panel, botón **Connect**. Necesita **dos** cadenas de conexión (la misma base, dos direcciones):

   | Variable | Qué es | Cómo se ve |
   |---|---|---|
   | `DATABASE_URL` | Conexión **agrupada** (pooled). La usa la aplicación. | host con `-pooler`, termina en `?sslmode=require` |
   | `DIRECT_URL` | Conexión **directa**. La usan las migraciones. | host **sin** `-pooler`, termina en `?sslmode=require` |

3. Pegue ambas en `backend/.env`.
4. Cree las tablas y los datos (desde su computador, apuntando a Neon):
   ```powershell
   npm --prefix backend run db:migrate
   $env:ADMIN_INITIAL_PASSWORD="UnaClaveFuerte1"     # no deje "Admin1" en un sistema desplegado
   npm --prefix backend run db:seed
   ```
   El `seed` carga también los datos **ficticios** de demostración (ciudadanos y la fuente simulada de Defensa); sin ellos las solicitudes de registro quedarían siempre «pendientes de revisión».
5. Neon **suspende la base** tras un rato sin uso: la primera consulta después de una pausa puede tardar unos segundos. El backend ya espera hasta 20 s por esa primera conexión (`DB_CONNECT_TIMEOUT_MS`).
6. Recomendado: use una **rama** (branch) de Neon para desarrollo y otra para producción, así no mezcla datos.

Las pruebas automáticas (`npm test`) siguen usando una base **aparte** y desechable cuyo nombre termina en `_test`; no las apunte a su base real.

## 2. Backend + web en un servicio (ejemplo: Render)

El proyecto incluye un `Dockerfile` en la raíz que compila la web, instala el backend y, al iniciar, aplica las migraciones y arranca el servidor. Sirve en cualquier plataforma que ejecute contenedores (Render, Railway, Fly.io, Google Cloud Run…).

En Render:

1. Suba el proyecto a un repositorio de GitHub (el `.gitignore` ya excluye `.env`, `node_modules`, etc.).
2. **New → Web Service** → elija el repositorio → **Runtime: Docker** (usa el `Dockerfile` de la raíz).
3. En **Environment** agregue las variables:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | cadena **con** `-pooler` de Neon |
   | `DIRECT_URL` | cadena **sin** `-pooler` de Neon |
   | `JWT_ACCESS_SECRET` | un secreto largo propio: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `MAIL_MODE` | `smtp` (**obligatorio** en producción) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | datos de su proveedor de correo |
   | `MAIL_FROM` | remitente, p. ej. `"Registraduría Konrad Lorenz <no-reply@su-dominio>"` |
   | `CORS_ORIGINS` | no hace falta para la web ni el móvil (mismo origen / app nativa) |

4. **Health Check Path:** `/api/v1/health`.
5. Despliegue. Al terminar tendrá una URL `https://su-app.onrender.com`. **Ábrala en el navegador: ahí está la web.** Esa misma URL es la que usará el móvil.

### Correo en producción
El enunciado exige enviar la contraseña temporal por correo y el modo de correo simulado está **prohibido** en producción (el servidor no arranca). Necesita un proveedor SMTP: por ejemplo Gmail con «contraseña de aplicación», Brevo, Resend o Mailtrap (su bandeja de pruebas captura los correos sin entregarlos, útil para una demostración). Revise los límites actuales de cada proveedor.

### Limitaciones de los planes gratuitos (verifique las condiciones vigentes)
- **Render gratuito:** unos 512 MB de RAM, CPU muy limitada y el servicio se **duerme tras ~15 min** sin tráfico; la primera petición posterior tarda cerca de un minuto. Ábralo unos minutos antes de una demostración.
- **Lectura de MRZ (OCR):** consume memoria y CPU; en un plan muy pequeño puede ser lenta o quedarse sin memoria. Si pasa, suba el tamaño de la instancia o use solo el escáner de código de barras y la entrada manual (el resto funciona igual).
- **Neon gratuito:** la base se suspende sola (ver arriba).

## 3. App móvil (APK) con EAS Build

1. En `mobile/eas.json` reemplace `https://REEMPLACE-CON-LA-URL-DE-SU-BACKEND` por la URL de su servicio (sin `/` final). Está en los perfiles `preview` y `production`. Esa URL queda **dentro** de la app: es pública, no ponga secretos en variables `EXPO_PUBLIC_*`.
2. Instale y entre:
   ```powershell
   npm install -g eas-cli
   eas login
   cd mobile
   eas init            # asocia el proyecto a su cuenta de Expo
   eas build -p android --profile preview
   ```
3. Al terminar, EAS entrega un enlace para descargar el **APK**; instálelo en el teléfono (permita instalar de fuentes desconocidas). Ya no necesita Expo Go, ni la IP, ni estar en la misma red.
4. El plan gratuito de EAS limita el número de compilaciones al mes y usa una cola de baja prioridad (puede esperar bastante). Revise [expo.dev/pricing](https://expo.dev/pricing).

Para desarrollo local con el teléfono sigue sirviendo `npm run dev:movil` (detecta la IP sola) o `npm run dev:movil -- --url https://su-app.onrender.com` para probar contra el servidor desplegado.

## 4. Lista de comprobación tras desplegar
1. `https://su-app…/api/v1/health` → `{"estado":"ok"}`.
2. Abrir la URL en el navegador → aparece el login. Ingresar con `1000000001` y la contraseña que definió en `ADMIN_INITIAL_PASSWORD`; cambiarla.
3. En el móvil: **Solicitar acceso** con uno de los registros ficticios del README → debe llegar el **correo real** con la contraseña temporal → iniciar sesión → cambiarla → consultar.
4. Cambiar el `JWT_ACCESS_SECRET` de ejemplo y revisar que ningún secreto esté en el repositorio.

## 5. Pendientes y riesgos conocidos del despliegue
- Datos **ficticios** y fuentes **simuladas**: no despliegue esto como sistema real. Una integración con Defensa o antecedentes judiciales requiere autorización y revisión legal.
- Con instancias gratuitas, la primera respuesta puede tardar (servicio y base dormidos).
- Si más adelante agrega varias instancias del backend, el límite de intentos (rate limit) es **en memoria** por instancia.
- Compruebe el `Dockerfile` con `docker build -t consulta-ciudadano .` antes de subirlo; si falla, envíe el error.
