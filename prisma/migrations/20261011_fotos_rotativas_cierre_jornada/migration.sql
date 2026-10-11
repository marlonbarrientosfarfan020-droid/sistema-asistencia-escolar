-- Migration: 20261011_fotos_rotativas_cierre_jornada
-- Aditiva y no destructiva para cierre automático y políticas de fotografías rotativas

-- 1. Campos de protección y cierre en Asistencia
ALTER TABLE "Asistencia" ADD COLUMN IF NOT EXISTS "fotoProtegida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asistencia" ADD COLUMN IF NOT EXISTS "fotoEntradaProtegida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asistencia" ADD COLUMN IF NOT EXISTS "fotoSalidaProtegida" BOOLEAN NOT NULL DEFAULT false;

-- 2. Campos de rotación y protección en EvidenciaFotografica
ALTER TABLE "EvidenciaFotografica" ADD COLUMN IF NOT EXISTS "esActiva" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EvidenciaFotografica" ADD COLUMN IF NOT EXISTS "esProtegida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EvidenciaFotografica" ADD COLUMN IF NOT EXISTS "rotadaAt" TIMESTAMP(3);
ALTER TABLE "EvidenciaFotografica" ADD COLUMN IF NOT EXISTS "eliminadaBlobAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "EvidenciaFotografica_estudianteId_esActiva_idx" ON "EvidenciaFotografica"("estudianteId", "esActiva");
CREATE INDEX IF NOT EXISTS "EvidenciaFotografica_esProtegida_idx" ON "EvidenciaFotografica"("esProtegida");

-- 3. Tabla de Punteros Activos: FotoActivaEstudiante (1 entrada y 1 salida activa por estudiante/turno)
CREATE TABLE IF NOT EXISTS "FotoActivaEstudiante" (
    "id" SERIAL NOT NULL,
    "colegioId" TEXT NOT NULL DEFAULT 'SANTA_RITA_001',
    "estudianteId" INTEGER NOT NULL,
    "turnoId" INTEGER,
    "asistenciaId" INTEGER NOT NULL,
    "fechaDia" TEXT NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL DEFAULT 'ENTRADA',
    "evidenciaId" INTEGER,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoActivaEstudiante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotoActivaEstudiante_estudianteId_turnoId_tipo_key" ON "FotoActivaEstudiante"("estudianteId", "turnoId", "tipo");
CREATE INDEX IF NOT EXISTS "FotoActivaEstudiante_colegioId_idx" ON "FotoActivaEstudiante"("colegioId");
CREATE INDEX IF NOT EXISTS "FotoActivaEstudiante_asistenciaId_idx" ON "FotoActivaEstudiante"("asistenciaId");
CREATE INDEX IF NOT EXISTS "FotoActivaEstudiante_fechaDia_idx" ON "FotoActivaEstudiante"("fechaDia");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FotoActivaEstudiante_colegioId_fkey'
    ) THEN
        ALTER TABLE "FotoActivaEstudiante" ADD CONSTRAINT "FotoActivaEstudiante_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FotoActivaEstudiante_estudianteId_fkey'
    ) THEN
        ALTER TABLE "FotoActivaEstudiante" ADD CONSTRAINT "FotoActivaEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FotoActivaEstudiante_turnoId_fkey'
    ) THEN
        ALTER TABLE "FotoActivaEstudiante" ADD CONSTRAINT "FotoActivaEstudiante_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FotoActivaEstudiante_asistenciaId_fkey'
    ) THEN
        ALTER TABLE "FotoActivaEstudiante" ADD CONSTRAINT "FotoActivaEstudiante_asistenciaId_fkey" FOREIGN KEY ("asistenciaId") REFERENCES "Asistencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Tabla de Cola de Limpieza Segura de Blobs (conservación institucional y dry-run)
CREATE TABLE IF NOT EXISTS "ColaLimpiezaBlob" (
    "id" SERIAL NOT NULL,
    "colegioId" TEXT NOT NULL DEFAULT 'SANTA_RITA_001',
    "evidenciaId" INTEGER,
    "url" TEXT NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL DEFAULT 'ENTRADA',
    "estudianteId" INTEGER,
    "asistenciaId" INTEGER,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONSERVADO_POLITICA',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "ejecutadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColaLimpiezaBlob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ColaLimpiezaBlob_estado_idx" ON "ColaLimpiezaBlob"("estado");
CREATE INDEX IF NOT EXISTS "ColaLimpiezaBlob_colegioId_idx" ON "ColaLimpiezaBlob"("colegioId");
CREATE INDEX IF NOT EXISTS "ColaLimpiezaBlob_createdAt_idx" ON "ColaLimpiezaBlob"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ColaLimpiezaBlob_colegioId_fkey'
    ) THEN
        ALTER TABLE "ColaLimpiezaBlob" ADD CONSTRAINT "ColaLimpiezaBlob_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
