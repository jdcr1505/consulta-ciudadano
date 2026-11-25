    # Entrega 2 — Sprint 2

    Historias incluidas (asignación original del Excel, sin cambios): **HU04, HU05, HU06 y HU16**.
    Además, por decisión del equipo: lectura de la cédula digital mediante **MRZ**, verificación del Sprint 1 y rediseño visual.

    ## 1. Matriz de trazabilidad (Sprint 2)

    | HU | Actor | Actividad › Paso (VSM) | MVP | Pantalla / componente | Endpoint | Servicio | Entidades | Estado |
    |---|---|---|---|---|---|---|---|---|
    | HU04 Consultar Info. Ciudadano | Fuerza Pública (móvil) | Consultar Ciudadano › Buscar Ciudadano por Documento | 1 | `NuevaConsulta`, `LectorCodigo`, `LectorMrz`, `ConsultaManual`, `ConfirmarNumero` | `POST /consultas`, `POST /documentos/mrz` | `consultas.service`, `documentos.service`, `mrz.js` | ciudadano, consulta | Implementada · API probada · lector sin probar con cédulas reales |
    | HU05 Visualizar Info. Ciudadano | Fuerza Pública (móvil) | Consultar Ciudadano › Consultar la Info. del Ciudadano | 1 | `Resultado` | (respuesta de `POST /consultas`) | `consultas.service` | ciudadano | Implementada · UI sin probar en dispositivo |
    | HU06 Registrar Consulta Ciudadano | Fuerza Pública (móvil) | Registrar Consulta › Registrar Consulta Sobre el Ciudadano | 2 | (automático al consultar) | `POST /consultas` | `consultas.service` | consulta, auditoria | Implementada · API y BD probadas |
    | HU16 Seleccionar Info. Reporte | Administrador (web) | Generar Reportes › Seleccionar Info. por Incluir | 3 | `web/src/pages/Reportes.jsx` | `GET /reportes/ciudadanos/vista-previa` | `reportes.service` | ciudadano, consulta | Implementada (criterios y vista previa) · el PDF es HU17 (Sprint 3) |

    Mapeo de supuestos (el Excel no documenta criterios de aceptación de estas HU): **HU04** = buscar al ciudadano por documento (escaneo, MRZ o digitación), **HU05** = mostrar el resultado con los datos mínimos, **HU06** = persistir cada consulta (funcionario, ciudadano, resultado, fecha y hora, origen).

    ## 2. API nueva

    | Método y ruta | Acceso | Descripción |
    |---|---|---|
    | `POST /consultas` `{identificacion, origen: ESCANER\|MANUAL}` | `consultas:crear` (limitado a 60/min por usuario) | Normaliza, busca, **registra** y responde `{consulta, resultado, ciudadano:{identificacion, nombres, apellidos}}` |
    | `POST /documentos/mrz` `{imagen: base64}` | `consultas:crear` (20/min) | Lee la MRZ con OCR. `{valido, identificacion, metodo, intentos}` o `{valido:false, motivo, huella}` |
    | `GET /reportes/ciudadanos/vista-previa?estado=&columnas=&page=&pageSize=` | `reportes:leer` | Una fila por ciudadano activo. `columnas` opcionales: `resultado`, `ultimaConsulta` |
    | `GET /resumen` | sesión | Indicadores de inicio según permisos |

    **Respuesta:** `{consulta, resultado: REQUERIDO|NO_REQUERIDO, registrado: bool, ciudadano: {identificacion, nombres, apellidos} | null}`. Quien **no figura en el sistema** recibe `resultado: NO_REQUERIDO`, `registrado: false` y `ciudadano: null` (decisión B8); internamente la consulta se guarda como `NO_ENCONTRADO`.
    **Errores diferenciados:** `400 IDENTIFICACION_INVALIDA`, `403 CONSULTA_NO_AUTORIZADA` (queda auditada), `503 SERVICIO_NO_DISPONIBLE` (**nunca** devuelve un resultado y no registra consulta) y `429`.
    Un error de conexión **no** se interpreta como «No requerido»: la app móvil muestra «Sin conexión / Servicio no disponible» con la aclaración explícita.

    **Base de datos:** nueva tabla `consulta` (solo inserción por trigger, `CHECK` de coherencia resultado/ciudadano, índices por usuario+fecha, ciudadano y resultado+fecha). Migración `20261101000000_sprint2_consulta`.

    ## 3. Lectura de las cédulas

    | Cédula | Qué se lee | Cómo | Estado |
    |---|---|---|---|
    | Amarilla (con hologramas) | Código de barras largo de atrás (PDF417) | `expo-camera` en el teléfono; se extraen **números candidatos** y el funcionario **confirma** | La posición del número dentro del código es una **heurística sin verificar con cédulas reales**; la confirmación visual y el «Diagnóstico del lector» cubren ese riesgo |
    | Digital (policarbonato) | El código QR **está cifrado** → no se usa. Se lee la **zona MRZ** (líneas de letras con «<») | Foto desde la app → servidor → OCR (Tesseract) → parser ICAO 9303 TD1 con **dígitos de control** | Verificado con imágenes **sintéticas**; **no** con una cédula real |
    | Cualquiera | Número digitado | Entrada manual | Probada (API) |

    **Validación de la MRZ:** se acepta un número solo si su dígito de control (pesos 7-3-1) cuadra; se toleran errores típicos del OCR (`C0L`, `O`/`0`, símbolos por «<»). Soporta número de hasta 9 caracteres, de más de 9 (campo opcional, según ICAO) y un número nacional en el campo opcional (menor confianza). Si no cuadra, **no se entrega ningún número**.

    **Supuestos sobre la MRZ (por confirmar con tu cédula):** formato TD1 de 3 líneas × 30 caracteres, país `COL` en las posiciones 3–5 de la primera línea y número de documento en el campo estándar. Si tu cédula digital organiza la MRZ de otra forma, la app mostrará «MRZ no encontrada» o «dígito de control inválido» y la respuesta incluye una **huella** de lo leído (`9` = dígito, `A` = letra, `<`) que se puede compartir sin revelar datos para ajustar el parser.

    **Privacidad de la foto:** se envía solo para esta lectura, se procesa **en memoria**, no se guarda ni se registra (la auditoría guarda método e intentos, no el contenido), exige sesión y permiso, tiene límite de tamaño (3 MB, solo JPEG/PNG) y de frecuencia. Alternativa futura con mayor privacidad: OCR en el dispositivo (ML Kit), que requiere una *development build* en lugar de Expo Go.

    ## 4. Decisiones y supuestos del Sprint 2

    | # | Supuesto |
    |---|---|
    | B1 | Se quitan los ceros de relleno del número leído (`0001012345` → `1012345`) y se buscan también las variantes almacenadas con ceros (conserva el requisito de texto con ceros iniciales) |
    | B2 | **(Revisada)** Desactivar un ciudadano (HU14) lo oculta de listados y reportes, pero **no cambia la consulta**: un registro «requerido» desactivado sigue siendo «requerido». Evita que una desactivación lo convierta en «no requerido» por la regla B8 |
    | B3 | La consulta de un número que no figura **se registra** como `NO_ENCONTRADO` (internamente); los errores de servicio solo van a auditoría/log |
    | B4 | HU05 muestra datos mínimos: identificación, nombres, apellidos y resultado (minimización de datos personales) |
    | B5 | HU16 (opción A aprobada): una fila por ciudadano activo; «Resultado» = estado vigente; «Última consulta» = máxima fecha en `consulta` |
    | B6 | «Consultas de hoy» usa el día calendario de Colombia (UTC−5) |
    | B8 | **Quien no figura en el sistema se considera «No requerido»** (decisión del equipo): no hay requerimiento registrado. La app lo aclara («no figura en el sistema»). Sustituye al estado de error «ciudadano inexistente» previsto inicialmente. Un fallo de conexión o de servicio sigue siendo un error y **nunca** se muestra como «No requerido» |
    | B7 | El botón «Generar PDF» de la web está **deshabilitado** hasta HU17 y lo indica en pantalla |

    ## 5. Pruebas (ejecutadas en el entorno de generación)

    | Suite | Resultado |
    |---|---|
    | Backend — unitarias + integración API/BD contra PostgreSQL 16 real (consultas, reportes, MRZ, despliegue/web estática, OCR real opcional con `OCR_REAL=1`) | **211 / 211** + 1 opcional (OCR real) |
    | Web — Testing Library con red simulada | **15 / 15** |
    | Móvil — lógica de validación y extracción (PDF417 incluye cadenas de dígitos pegadas) | **27 / 27** |
    | Scripts — detección de la IP de red | **6 / 6** |
    | Recorrido completo contra el **servidor real** (`server.js`, OCR real, BD de desarrollo): registro → credenciales → cambio de contraseña → consultas → MRZ → reporte → resumen | **15 / 15 comprobaciones** |
    | Móvil — empaquetado Android (Metro/Hermes) | Compila (849 módulos) — no es un APK |

    Vectores oficiales ICAO 9303 verificados en las pruebas del dígito de control (`520727`→3, `L898902C3`→6, `740812`→2, `120415`→9).

    ## 6. Verificación del Sprint 1 (a petición)
    - Entorno reconstruido **desde cero** a partir del zip entregado (el entorno de generación se reinició): instalación limpia, migración, seed y suites completas → backend 143/143, web 9/9, móvil 17/17 antes de añadir el Sprint 2; y las mismas pruebas siguen pasando dentro de las suites actuales.
    - El recorrido de HU01–HU03 también se ejecutó contra el servidor real (registro validado, contraseña temporal, bloqueo por cambio obligatorio, cambio de contraseña).
    - Las tareas de **documentación y despliegue** del Backlog (manuales, capacitación, guía de despliegue) siguen pendientes para la fase de documentación final, como se acordó.

    ## 7. Rediseño visual
    - **Identidad:** *guilloché* (trama de líneas onduladas de cédulas y billetes) como seña visual en el acceso, la barra lateral y las tarjetas de resultado.
    - **Web:** sidebar con iconos y avatar, barra superior, **Inicio** con indicadores y barras de proporción, toasts, esqueletos de carga, estados vacíos ilustrados, tablas con encabezado fijo y resaltado de fila, diálogos con animación, tres radios y sombras en dos niveles. Respeta `prefers-reduced-motion`.
    - **Móvil:** cabecera con guilloché, opciones táctiles grandes, flujo guiado (método → lectura → confirmación → resultado), **tarjeta de resultado** con color e icono (rojo = requerido, verde = no requerido, gris = sin registro, ámbar = error), animación de entrada.
    - El estado no depende solo del color: siempre hay icono y texto.
    - **No verificado:** el aspecto real en navegador y en teléfono (solo compila y pasa pruebas de comportamiento); es normal que haya ajustes de espaciado tras verlo.

    ## 8. Limitaciones y riesgos
    1. **Precisión del OCR en cédulas reales:** sin medir. Brillo, curvatura y hologramas pueden degradar la lectura; los dígitos de control evitan entregar un número equivocado, pero pueden causar «no se pudo leer».
    2. **PDF417 de la cédula amarilla:** la extracción del número es heurística; siempre se confirma.
    3. **Primera lectura MRZ lenta** (arranque del motor, ~2–5 s) y consumo de CPU del servidor; el motor se reutiliza después.
    4. Instalar `sharp` y `tesseract.js` descarga binarios desde npm; si la red de su equipo los bloquea, la lectura de MRZ no estará disponible (el resto funciona).
    5. `npm audit`: backend y web 0 vulnerabilidades; móvil 10 (herramientas de Expo, ver Entrega 1).
    6. Aviso `DeprecationWarning` de `pg` (ver Entrega 1, §6.7).

    ## 9. Registro de defectos
    | # | Hallazgo | Detección | Corrección |
    |---|---|---|---|
    | D3 | La BD de pruebas ya existente no recibía las migraciones nuevas (solo se creaba el esquema si estaba vacía) → todas las pruebas de integración fallaban al actualizar | Primera ejecución del Sprint 2 | El ayudante recrea el esquema completo con todas las migraciones en cada archivo (solo si el nombre termina en `_test`) |

    ## 10. Pendiente (Sprint 3)
    HU07 (historial), HU08–HU09 y HU15 (novedades), HU10–HU11 (solicitudes), HU17 (PDF), y la documentación final (manuales, guía de despliegue, presentación, guía de sustentación).

    ## 11. Ajustes posteriores al cierre del Sprint 2 (despliegue y scripts)
    - **Scripts de raíz:** `setup`, `dev` (API + web en una terminal), `dev:movil` (detecta la IP), `dev:todo`, `doctor`, `build`, `start`, `test`, `db:up/down`.
    - **Despliegue:** `Dockerfile` (backend + web compilada en el mismo origen), `docker-compose.yml` con `restart: unless-stopped`, configuración para **Neon** (`DATABASE_URL` agrupada + `DIRECT_URL` directa para migraciones, pool y tiempos de espera para bases que se suspenden), `eas.json` para el APK. Guía en `docs/DESPLIEGUE.md`.
    - **Backend listo para producción:** `--env-file-if-exists` (no exige `.env`), `trust proxy`, CSP con `upgrade-insecure-requests` en producción, cookie `Secure`, `start:prod` (migra y arranca), `SEED_DEMO`.
    - **Verificado localmente:** modo producción sirviendo la web y la API, cookie y cabeceras, `npm run dev`, `doctor` con la BD encendida y apagada. **No verificado:** construcción del `Dockerfile`, conexión a Neon, despliegue en Render, compilación EAS, SMTP real.
