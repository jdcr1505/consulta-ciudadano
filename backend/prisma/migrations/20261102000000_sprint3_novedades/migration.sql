-- Sprint 3 (HU08, HU09, HU15): novedades sobre ciudadanos y su historial de estados.

CREATE TABLE "novedad" (
  "id" SERIAL NOT NULL,
  "ciudadano_id" INTEGER NOT NULL,
  "registrada_por" INTEGER NOT NULL,
  "descripcion" VARCHAR(1000) NOT NULL,
  "estado" "EstadoNovedad" NOT NULL DEFAULT 'REGISTRADA',
  "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizada_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "novedad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "novedad_descripcion_chk" CHECK (char_length(btrim("descripcion")) >= 10)
);
CREATE INDEX "novedad_estado_idx" ON "novedad"("estado");
CREATE INDEX "novedad_registrada_por_creada_en_idx" ON "novedad"("registrada_por", "creada_en" DESC);
CREATE INDEX "novedad_ciudadano_id_idx" ON "novedad"("ciudadano_id");

CREATE TABLE "novedad_historial" (
  "id" SERIAL NOT NULL,
  "novedad_id" INTEGER NOT NULL,
  "estado_anterior" "EstadoNovedad",
  "estado_nuevo" "EstadoNovedad" NOT NULL,
  "cambiado_por" INTEGER NOT NULL,
  "comentario" VARCHAR(500),
  "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "novedad_historial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "novedad_historial_cambio_chk" CHECK ("estado_anterior" IS DISTINCT FROM "estado_nuevo")
);
CREATE INDEX "novedad_historial_novedad_id_fecha_idx" ON "novedad_historial"("novedad_id", "fecha");

ALTER TABLE "novedad" ADD CONSTRAINT "novedad_ciudadano_id_fkey" FOREIGN KEY ("ciudadano_id") REFERENCES "ciudadano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedad" ADD CONSTRAINT "novedad_registrada_por_fkey" FOREIGN KEY ("registrada_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedad_historial" ADD CONSTRAINT "novedad_historial_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedad_historial" ADD CONSTRAINT "novedad_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El historial de cambios de estado es de solo inserción (usa la función creada en la migración del Sprint 2)
CREATE TRIGGER "novedad_historial_no_update_delete"
  BEFORE UPDATE OR DELETE ON "novedad_historial"
  FOR EACH ROW EXECUTE FUNCTION "tabla_solo_insercion"();