-- Migración Aditiva: Tabla de Idempotencia Persistente para Vercel Serverless
-- 100% compatible con datos existentes

CREATE TABLE IF NOT EXISTS "RegistroIdempotencia" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "tipoOperacion" TEXT NOT NULL DEFAULT 'ASISTENCIA',
    "estudianteId" INTEGER,
    "colegioId" TEXT NOT NULL DEFAULT 'SANTA_RITA_001',
    "statusCode" INTEGER NOT NULL,
    "respuesta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroIdempotencia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistroIdempotencia_clave_key" ON "RegistroIdempotencia"("clave");
CREATE INDEX IF NOT EXISTS "RegistroIdempotencia_clave_idx" ON "RegistroIdempotencia"("clave");
CREATE INDEX IF NOT EXISTS "RegistroIdempotencia_expiraAt_idx" ON "RegistroIdempotencia"("expiraAt");
CREATE INDEX IF NOT EXISTS "RegistroIdempotencia_estudianteId_createdAt_idx" ON "RegistroIdempotencia"("estudianteId", "createdAt");
