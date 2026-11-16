-- Sistema de Consulta Ciudadano — esquema de base de datos (PostgreSQL 14+)
-- Generado desde backend/prisma/migrations (init + Sprint 2). Con Prisma prefiera: npm run db:migrate
-- Sprint 2: 13 tablas (novedad y novedad_historial llegan en el Sprint 3).

-- ===== 20261029000000_init =====
-- Migración inicial: Sistema de Consulta Ciudadano (Sprint 1)
-- Incluye lo que Prisma no expresa: CHECK, índices parciales, FK compuestas y triggers.

CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE "EstadoSolicitud" AS ENUM ('VALIDADA', 'PENDIENTE_REVISION', 'APROBADA', 'RECHAZADA');
CREATE TYPE "ResultadoValidacion" AS ENUM ('VALIDADO', 'NO_ENCONTRADO', 'DATOS_NO_COINCIDEN', 'SERVICIO_NO_DISPONIBLE');
CREATE TYPE "Rh" AS ENUM ('POSITIVO', 'NEGATIVO');
CREATE TYPE "GrupoSanguineo" AS ENUM ('A', 'B', 'AB', 'O');
CREATE TYPE "EstadoJudicial" AS ENUM ('REQUERIDO', 'NO_REQUERIDO');
CREATE TYPE "ResultadoConsulta" AS ENUM ('REQUERIDO', 'NO_REQUERIDO', 'NO_ENCONTRADO');
CREATE TYPE "OrigenConsulta" AS ENUM ('ESCANER', 'MANUAL');
CREATE TYPE "EstadoNovedad" AS ENUM ('REGISTRADA', 'EN_REVISION', 'ATENDIDA', 'DESCARTADA');

CREATE TABLE "fuerza_publica" (
  "id" SERIAL NOT NULL,
  "nombre" VARCHAR(40) NOT NULL,
  CONSTRAINT "fuerza_publica_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fuerza_publica_nombre_key" ON "fuerza_publica"("nombre");

CREATE TABLE "rango" (
  "id" SERIAL NOT NULL,
  "fuerza_publica_id" INTEGER NOT NULL,
  "nombre" VARCHAR(60) NOT NULL,
  CONSTRAINT "rango_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rango_fuerza_publica_id_nombre_key" ON "rango"("fuerza_publica_id", "nombre");
CREATE UNIQUE INDEX "rango_fuerza_publica_id_id_key" ON "rango"("fuerza_publica_id", "id");

CREATE TABLE "rol" (
  "id" SERIAL NOT NULL,
  "nombre" VARCHAR(40) NOT NULL,
  "descripcion" VARCHAR(200),
  "es_base" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

CREATE TABLE "opcion" (
  "id" SERIAL NOT NULL,
  "codigo" VARCHAR(40) NOT NULL,
  "nombre" VARCHAR(80) NOT NULL,
  CONSTRAINT "opcion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "opcion_codigo_key" ON "opcion"("codigo");

CREATE TABLE "permiso" (
  "id" SERIAL NOT NULL,
  "opcion_id" INTEGER NOT NULL,
  "accion" VARCHAR(30) NOT NULL,
  "codigo" VARCHAR(80) NOT NULL,
  CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");
CREATE UNIQUE INDEX "permiso_opcion_id_accion_key" ON "permiso"("opcion_id", "accion");

CREATE TABLE "rol_permiso" (
  "rol_id" INTEGER NOT NULL,
  "permiso_id" INTEGER NOT NULL,
  CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id", "permiso_id")
);

CREATE TABLE "usuario" (
  "id" SERIAL NOT NULL,
  "identificacion" VARCHAR(15) NOT NULL,
  "nombres" VARCHAR(100) NOT NULL,
  "apellidos" VARCHAR(100) NOT NULL,
  "correo" VARCHAR(254) NOT NULL,
  "rol_id" INTEGER NOT NULL,
  "fuerza_publica_id" INTEGER,
  "rango_id" INTEGER,
  "id_fuerza" VARCHAR(30),
  "password_hash" TEXT NOT NULL,
  "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT true,
  "password_expira_en" TIMESTAMPTZ(3),
  "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
  "bloqueado_hasta" TIMESTAMPTZ(3),
  "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "usuario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usuario_identificacion_formato_chk" CHECK ("identificacion" ~ '^[0-9]{6,10}$'),
  CONSTRAINT "usuario_correo_minuscula_chk" CHECK ("correo" = lower("correo"))
);
CREATE UNIQUE INDEX "usuario_identificacion_key" ON "usuario"("identificacion");
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");
CREATE UNIQUE INDEX "usuario_fuerza_publica_id_id_fuerza_key" ON "usuario"("fuerza_publica_id", "id_fuerza");
CREATE INDEX "usuario_estado_idx" ON "usuario"("estado");

CREATE TABLE "solicitud" (
  "id" SERIAL NOT NULL,
  "identificacion" VARCHAR(15) NOT NULL,
  "nombres" VARCHAR(100) NOT NULL,
  "apellidos" VARCHAR(100) NOT NULL,
  "correo" VARCHAR(254) NOT NULL,
  "fuerza_publica_id" INTEGER NOT NULL,
  "rango_id" INTEGER NOT NULL,
  "id_fuerza" VARCHAR(30) NOT NULL,
  "resultado_validacion" "ResultadoValidacion" NOT NULL,
  "estado" "EstadoSolicitud" NOT NULL,
  "usuario_id" INTEGER,
  "resuelta_por" INTEGER,
  "resuelta_en" TIMESTAMPTZ(3),
  "motivo" VARCHAR(500),
  "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "solicitud_identificacion_formato_chk" CHECK ("identificacion" ~ '^[0-9]{6,10}$')
);
CREATE UNIQUE INDEX "solicitud_usuario_id_key" ON "solicitud"("usuario_id");
CREATE INDEX "solicitud_estado_idx" ON "solicitud"("estado");
CREATE UNIQUE INDEX "solicitud_identificacion_pendiente_key"
  ON "solicitud"("identificacion") WHERE "estado" = 'PENDIENTE_REVISION';

CREATE TABLE "sesion" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expira_en" TIMESTAMPTZ(3) NOT NULL,
  "revocada" BOOLEAN NOT NULL DEFAULT false,
  "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

CREATE TABLE "ciudadano" (
  "id" SERIAL NOT NULL,
  "identificacion" VARCHAR(15) NOT NULL,
  "nombres" VARCHAR(100) NOT NULL,
  "apellidos" VARCHAR(100) NOT NULL,
  "fecha_nacimiento" DATE NOT NULL,
  "lugar_nacimiento" VARCHAR(100) NOT NULL,
  "fecha_expedicion" DATE NOT NULL,
  "lugar_expedicion" VARCHAR(100) NOT NULL,
  "rh" "Rh" NOT NULL,
  "grupo_sanguineo" "GrupoSanguineo" NOT NULL,
  "estatura_cm" SMALLINT NOT NULL,
  "estado_judicial" "EstadoJudicial" NOT NULL DEFAULT 'NO_REQUERIDO',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_por" INTEGER,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ciudadano_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ciudadano_identificacion_formato_chk" CHECK ("identificacion" ~ '^[0-9]{6,10}$'),
  CONSTRAINT "ciudadano_estatura_chk" CHECK ("estatura_cm" BETWEEN 50 AND 250),
  CONSTRAINT "ciudadano_fechas_chk" CHECK (
    "fecha_nacimiento" <= CURRENT_DATE
    AND "fecha_expedicion" > "fecha_nacimiento"
    AND "fecha_expedicion" <= CURRENT_DATE)
);
CREATE UNIQUE INDEX "ciudadano_identificacion_key" ON "ciudadano"("identificacion");
CREATE INDEX "ciudadano_estado_judicial_idx" ON "ciudadano"("estado_judicial");

CREATE TABLE "auditoria" (
  "id" BIGSERIAL NOT NULL,
  "usuario_id" INTEGER,
  "accion" VARCHAR(60) NOT NULL,
  "entidad" VARCHAR(40),
  "entidad_id" VARCHAR(40),
  "resultado" VARCHAR(20) NOT NULL,
  "ip" VARCHAR(64),
  "detalle" JSONB,
  "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_fecha_idx" ON "auditoria"("fecha");
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- Fuente SIMULADA del Departamento de Defensa (datos ficticios, solo desarrollo/demostración)
CREATE TABLE "sim_defensa" (
  "identificacion" VARCHAR(15) NOT NULL,
  "nombres" VARCHAR(100) NOT NULL,
  "apellidos" VARCHAR(100) NOT NULL,
  "fuerza" VARCHAR(40) NOT NULL,
  "rango" VARCHAR(60) NOT NULL,
  "id_fuerza" VARCHAR(30) NOT NULL,
  CONSTRAINT "sim_defensa_pkey" PRIMARY KEY ("identificacion")
);

-- Claves foráneas
ALTER TABLE "rango" ADD CONSTRAINT "rango_fuerza_publica_id_fkey" FOREIGN KEY ("fuerza_publica_id") REFERENCES "fuerza_publica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permiso" ADD CONSTRAINT "permiso_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_fuerza_publica_id_fkey" FOREIGN KEY ("fuerza_publica_id") REFERENCES "fuerza_publica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rango_id_fkey" FOREIGN KEY ("rango_id") REFERENCES "rango"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_fuerza_publica_id_fkey" FOREIGN KEY ("fuerza_publica_id") REFERENCES "fuerza_publica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_rango_id_fkey" FOREIGN KEY ("rango_id") REFERENCES "rango"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_resuelta_por_fkey" FOREIGN KEY ("resuelta_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ciudadano" ADD CONSTRAINT "ciudadano_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integridad adicional (no expresable en Prisma): el rango debe pertenecer a la fuerza indicada
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rango_de_fuerza_fkey"
  FOREIGN KEY ("fuerza_publica_id", "rango_id") REFERENCES "rango"("fuerza_publica_id", "id");
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_rango_de_fuerza_fkey"
  FOREIGN KEY ("fuerza_publica_id", "rango_id") REFERENCES "rango"("fuerza_publica_id", "id");

-- Auditoría de solo inserción (inmutable)
CREATE FUNCTION "auditoria_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla auditoria es de solo inserción';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "auditoria_no_update_delete"
  BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION "auditoria_inmutable"();

-- ===== 20261101000000_sprint2_consulta =====
-- Sprint 2 (HU04–HU06): registro de consultas del estado judicial.

CREATE TABLE "consulta" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "ciudadano_id" INTEGER,
  "identificacion_consultada" VARCHAR(15) NOT NULL,
  "resultado" "ResultadoConsulta" NOT NULL,
  "origen" "OrigenConsulta" NOT NULL,
  "fecha_hora" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consulta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consulta_identificacion_formato_chk" CHECK ("identificacion_consultada" ~ '^[0-9]{6,10}$'),
  -- Coherencia: hay ciudadano si y solo si el resultado no es NO_ENCONTRADO
  CONSTRAINT "consulta_resultado_ciudadano_chk" CHECK (("resultado" = 'NO_ENCONTRADO') = ("ciudadano_id" IS NULL))
);

CREATE INDEX "consulta_usuario_id_fecha_hora_idx" ON "consulta"("usuario_id", "fecha_hora" DESC);
CREATE INDEX "consulta_ciudadano_id_idx" ON "consulta"("ciudadano_id");
CREATE INDEX "consulta_resultado_fecha_hora_idx" ON "consulta"("resultado", "fecha_hora");

ALTER TABLE "consulta" ADD CONSTRAINT "consulta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_ciudadano_id_fkey" FOREIGN KEY ("ciudadano_id") REFERENCES "ciudadano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El historial de consultas es de solo inserción (evidencia de auditoría)
CREATE FUNCTION "tabla_solo_insercion"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "consulta_no_update_delete"
  BEFORE UPDATE OR DELETE ON "consulta"
  FOR EACH ROW EXECUTE FUNCTION "tabla_solo_insercion"();

