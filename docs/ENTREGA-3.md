# Entrega 3 — Sprint 3 y Despliegue Final

Historias incluidas (cierre del Backlog): **HU07, HU08, HU09, HU10, HU11, HU15 y HU17**.
Además, se completó el **despliegue integral en producción** (Neon PostgreSQL + Render Docker + SMTP real + APK Android con Expo EAS Build) y la actualización de la documentación final.

## 1. Matriz de trazabilidad (Sprint 3)

| HU | Actor | Actividad › Paso (VSM) | MVP | Pantalla / componente | Endpoints | Servicio | Entidades | Estado |
|---|---|---|---|---|---|---|---|---|
| HU07 Consultar Historial | Fuerza Pública y Administrador | Consultar Ciudadano › Consultar Historial de Consultas | 2 | Web: `Historial.jsx` / Móvil: `Historial.js` | `GET /consultas`, `GET /consultas/:id` | `consultas.service` | consulta, ciudadano, usuario | Implementada y verificada en producción |
| HU08 Registrar Novedad | Administrador / Operador autorizado | Gestionar Novedades › Registrar Novedad del Ciudadano | 2 | Web: `Novedades.jsx` | `POST /novedades` | `novedades.service` | novedad, novedad_historial, ciudadano, auditoria | Implementada y verificada |
| HU09 Consultar Novedades | Fuerza Pública y Administrador | Gestionar Novedades › Consultar Novedades | 2 | Web: `Novedades.jsx` / Móvil: `Resultado.js` | `GET /novedades`, `GET /novedades/:id` | `novedades.service` | novedad, ciudadano | Implementada y verificada |
| HU15 Gestionar Estado de Novedades | Administrador | Gestionar Novedades › Actualizar / Cerrar Novedad | 3 | Web: `Novedades.jsx` | `PATCH /novedades/:id`, `GET /novedades/:id/historial` | `novedades.service` | novedad, novedad_historial, auditoria | Implementada y verificada |
| HU10 Listar Solicitudes Pendientes | Administrador | Gestionar Solicitudes › Consultar Solicitudes de Acceso | 2 | Web: `Solicitudes.jsx` | `GET /solicitudes`, `GET /solicitudes/:id` | `solicitudes.service` | solicitud, fuerza_publica, rango | Implementada y verificada |
| HU11 Aprobar / Rechazar Solicitud | Administrador | Gestionar Solicitudes › Resolver Solicitud Pendiente | 2 | Web: `Solicitudes.jsx` | `POST /solicitudes/:id/aprobar`, `POST /solicitudes/:id/rechazar` | `solicitudes.service`, `auth/credenciales`, `integrations/mail` | solicitud, usuario, auditoria | Implementada con envío SMTP real |
| HU17 Generar Reporte PDF | Administrador | Generar Reportes › Exportar Reporte en PDF | 3 | Web: `Reportes.jsx` | `GET /reportes/ciudadanos/pdf` | `reportes.service` | ciudadano, consulta, novedad | Implementada y verificada |

## 2. API incorporada (Sprint 3)

Base `/api/v1`. Todas las rutas requieren sesión autenticada y validación de permisos granulares en el servidor.

| Método y ruta | Permiso requerido | Descripción |
|---|---|---|
| `GET /consultas` | `consultas:leer` | Listado paginado con filtros por documento, resultado, funcionario y rango de fechas (UTC−5) |
| `GET /novedades`, `GET /novedades/:id` | `novedades:leer` | Consulta de novedades judiciales asociadas a ciudadanos y su trazabilidad |
| `POST /novedades` | `novedades:crear` | Registra una novedad sobre un ciudadano y actualiza su estado vigente si aplica |
| `PATCH /novedades/:id` | `novedades:editar` | Actualiza estado/observación de la novedad registrando el cambio en `novedad_historial` |
| `GET /solicitudes` | `solicitudes:leer` | Lista solicitudes de acceso (incluyendo las marcadas como `PENDIENTE_REVISION` por discrepancia o caída de Defensa) |
| `POST /solicitudes/:id/aprobar` | `solicitudes:gestionar` | Aprueba manualmente una solicitud pendiente, crea el usuario `FUNCIONARIO` y envía contraseña temporal por SMTP |
| `POST /solicitudes/:id/rechazar` | `solicitudes:gestionar` | Rechaza una solicitud pendiente dejando motivo registrado en auditoría (completa CA09 de HU03) |
| `GET /reportes/ciudadanos/pdf` | `reportes:leer` | Genera y descarga el documento PDF con los filtros y columnas seleccionados en HU16 |

**Base de datos:** nuevas tablas `novedad` y `novedad_historial` con restricciones de integridad y llaves foráneas hacia `ciudadano` y `usuario`. Migración `20261102000000_sprint3_novedad` aplicada en producción.

## 3. Reglas de negocio del Sprint 3
- **Resolución manual de solicitudes (HU10–HU11):** Cuando la validación automática contra `sim_defensa` deja una solicitud en `PENDIENTE_REVISION`, un administrador puede revisarla en la web. Si la **aprueba**, se dispara el mismo flujo transaccional de alta de usuario y envío de contraseña temporal por correo (si el correo falla, se revierte). Si la **rechaza**, el funcionario sigue sin poder ingresar y el login mantiene el mensaje genérico sin filtrar el estado interno (cierre de CA09).
- **Trazabilidad de novedades (HU08–HU09, HU15):** Toda creación o cambio de estado sobre una novedad inserta un registro inmutable en `novedad_historial` indicando usuario responsable, fecha/hora y detalle del cambio.
- **Historial de consultas (HU07):** Los funcionarios visualizan sus propias consultas realizadas desde el móvil, mientras que los perfiles administrativos con permiso global pueden auditar el historial completo.
- **Generación de PDF (HU17):** El reporte PDF respeta exactamente los filtros activos y las columnas seleccionadas en la vista previa (HU16), incluyendo encabezado institucional y marca de datos ficticios.

## 4. Verificación en producción y dispositivo real

A diferencia de las entregas anteriores (verificadas únicamente en entorno local), en el Sprint 3 se ejecutó y comprobó el despliegue completo:

| Componente | Entorno | Verificación realizada |
|---|---|---|
| Base de datos PostgreSQL | **Neon** (`us-east-2`, BD `neondb`) | 15 tablas creadas y 3 migraciones aplicadas (`init`, `sprint2_consulta`, `sprint3_novedad`) junto con datos semilla |
| Backend + Web estática | **Render** (`https://consulta-ciudadano.onrender.com`) | Construcción de contenedor Docker exitosa, `/api/v1/health` activo y autenticación web operativa |
| Servicio de correo | **Gmail SMTP** (`smtp.gmail.com:587`) | `MAIL_MODE=smtp` activo en producción; entrega real de contraseñas temporales verificada |
| App Móvil Android | **Expo EAS Build** (`@jdcr1505/consulta-ciudadano`) | Compilación de `.apk` con perfil `production`, instalación en dispositivo físico Android y operación verificada sobre red celular (4G) |

## 5. Registro de supuestos de esta entrega
| # | Supuesto | Motivo |
|---|---|---|
| C1 | Solo solicitudes en estado `PENDIENTE_REVISION` pueden aprobarse o rechazarse manualmente | Evita duplicar usuarios ya validados automáticamente en HU01 |
| C2 | El reporte PDF se genera directamente en el backend sin motores de navegador pesado (Chromium/Puppeteer) | Mantiene el consumo de RAM por debajo de 300 MB para operar de forma estable en contenedores de 512 MB (Render Free) |
| C3 | La URL de producción del backend se empaqueta en tiempo de compilación en `mobile/eas.json` (`EXPO_PUBLIC_API_URL`) | Elimina la dependencia de redes Wi-Fi locales o configuración manual de IP en el teléfono |

## 6. Limitaciones y consideraciones operativas
1. **Arranque en frío (*cold start*) en plan gratuito:** Tras ~15 minutos sin tráfico, Render suspende el contenedor; la primera petición desde la web o el `.apk` puede tardar entre 30 y 50 segundos mientras despierta el servidor y la base de datos en Neon.
2. **Lectura de cédulas físicas (OCR/PDF417):** El módulo MRZ funciona en producción sobre imágenes nítidas, aunque en instancias con CPU compartida (0.1 vCPU) la primera lectura tras reiniciar el contenedor toma unos segundos adicionales mientras carga el motor Tesseract.
3. **Entorno académico:** Tanto los ciudadanos como los registros de `sim_defensa` son ficticios.