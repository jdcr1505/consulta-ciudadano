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
