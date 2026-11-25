# Guía de despliegue

Arquitectura desplegada y verificada en producción (accesible por HTTPS sin depender de IP locales):

```
Teléfono (APK) ──┐
                 ├──►  [https://consulta-ciudadano.onrender.com](https://consulta-ciudadano.onrender.com)  ──►  Neon (PostgreSQL)
Navegador (web) ─┘          un solo servicio: API + web                (Ohio us-east-2)
```

- **Base de datos:** Neon PostgreSQL (`us-east-2`).
- **Backend + web:** un único servicio contenedor en Render (`us-east-2`) que sirve la web compilada desde el mismo origen que la API (evita problemas de CORS y mantiene activas las cookies `HttpOnly; Secure`).
- **Móvil:** APK compilado en la nube con Expo EAS Build (`@jdcr1505/consulta-ciudadano`) apuntando directamente a `https://consulta-ciudadano.onrender.com`.

> **Estado de verificación:** Despliegue ejecutado y verificado de extremo a extremo en Neon, Render (Docker + SMTP real) y Expo EAS Build (`.apk` instalado y probado en dispositivo físico Android mediante datos móviles).

## 1. Base de datos en Neon

1. En [neon.com](https://neon.com), crear el proyecto en la región **AWS US East (Ohio) `us-east-2`** (coincide con Render para minimizar latencia).
2. En **Connect**, obtener las **dos** cadenas de conexión de la base `neondb`:

   | Variable | Qué es | Cómo se ve |
   |---|---|---|
   | `DATABASE_URL` | Conexión **agrupada** (pooled). La usa la aplicación en tiempo de ejecución. | host con `-pooler`, termina en `?sslmode=require` |
   | `DIRECT_URL` | Conexión **directa**. La usan las migraciones de Prisma. | host **sin** `-pooler`, termina en `?sslmode=require` |

3. Aplicar esquema y datos iniciales (o restaurar respaldo local con `pg_dump`/`psql`):
   ```powershell
   npm --prefix backend run db:migrate
   $env:ADMIN_INITIAL_PASSWORD="UnaClaveFuerte1"
   npm --prefix backend run db:seed
   ```
   El `seed` carga los catálogos base (fuerzas, rangos, roles, permisos), el administrador inicial y los datos ficticios de demostración (`sim_defensa` y ciudadanos).
4. **Suspensión automática:** Neon suspende el cómputo tras unos minutos de inactividad; la primera consulta tras una pausa tarda unos segundos. El backend incluye tolerancia de conexión (`DB_CONNECT_TIMEOUT_MS`).

## 2. Backend + web en Render (Docker)

El `Dockerfile` de la raíz compila el frontend web (`web/dist`), instala dependencias de producción del backend y ejecuta `npm run start:prod` (aplica migraciones pendientes con `prisma migrate deploy` e inicia `src/server.js`).

Configuración aplicada en Render (**Web Service**):
- **Repositorio:** `jdcr1505/consulta-ciudadano`
- **Runtime:** `Docker` (usando el `Dockerfile` de la raíz)
- **Región:** `Ohio (US East)`
- **Health Check Path:** `/api/v1/health`

Variables de entorno configuradas en Render:

| Variable | Valor / Formato |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `DATABASE_URL` | Cadena **con** `-pooler` de Neon |
| `DIRECT_URL` | Cadena **sin** `-pooler` de Neon |
| `JWT_ACCESS_SECRET` | Secreto aleatorio de 32+ caracteres |
| `JWT_REFRESH_SECRET` | Secreto aleatorio distinto para rotación de sesiones |
| `MAIL_MODE` | `smtp` (**obligatorio** en producción; `dev` está bloqueado) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Cuenta remitente SMTP |
| `SMTP_PASS` | Contraseña de aplicación de 16 caracteres (sin espacios) |
| `MAIL_FROM` | Correo remitente |

### Limitaciones conocidas de los planes gratuitos
- **Render Free (512 MB RAM / 0.1 CPU):** Se suspende tras ~15 minutos sin tráfico; la primera petición tras el reposo tarda entre 30 y 50 segundos. Se recomienda abrir `https://consulta-ciudadano.onrender.com` un minuto antes de una presentación.
- **Lectura MRZ (OCR):** El arranque inicial de Tesseract consume CPU y memoria; en el plan gratuito conviene evitar envíos simultáneos de imágenes pesadas.
- **Neon Free:** La base se reactiva automáticamente en pocos segundos ante la primera consulta.

## 3. App móvil (APK) con Expo EAS Build

1. En `mobile/eas.json` se configuró la URL pública del backend en los perfiles `preview` y `production` (sin barra `/` final):
   ```json
   "env": {
     "EXPO_PUBLIC_API_URL": "[https://consulta-ciudadano.onrender.com](https://consulta-ciudadano.onrender.com)"
   }
   ```
2. Vinculación y compilación en la nube (desde `mobile/`):
   ```powershell
   cd mobile
   npx eas-cli login
   npx eas-cli build -p android --profile production
   ```
   *(Al ejecutar el primer build, EAS creó el proyecto `@jdcr1505/consulta-ciudadano`, registró el `projectId` en `mobile/app.json` y generó el Android Keystore remoto).*
3. **Instalación en dispositivo:** Descargar el artefacto `.apk` desde el panel de Expo (**Builds → Download**), habilitar *Permitir instalación desde esta fuente* en Android y aceptar la verificación de Play Protect (*Instalar de todas formas*). No requiere Expo Go ni conexión a la red local del computador.

## 4. Lista de comprobación verificada en producción
- [x] `https://consulta-ciudadano.onrender.com/api/v1/health` responde estado saludable.
- [x] `https://consulta-ciudadano.onrender.com` carga la interfaz web y autentica usuarios contra Neon.
- [x] Migraciones aplicadas en `neondb` (`init`, `sprint2_consulta`, `sprint3_novedad`).
- [x] Envío de correos funcionando mediante `smtp.gmail.com`.
- [x] APK compilado en EAS Build (`production`) e instalado en dispositivo Android físico operando sobre red celular (4G).

## 5. Consideraciones de seguridad y mantenimiento
- **Datos ficticios:** No utilizar este sistema con información real sin autorización legal e integración oficial con las entidades correspondientes.
- **Rotación de credenciales:** Tras demostraciones públicas, rotar `SMTP_PASS` y los secretos `JWT_*` desde el panel de Render.
- **Rate limiting:** El limitador de peticiones opera en memoria por instancia; suficiente para despliegue de instancia única.