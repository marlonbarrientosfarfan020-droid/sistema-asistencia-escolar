-- Migraci�n Aditiva: Seguridad y Aislamiento del Portal de Padres
-- Compatible 100% con datos existentes (sin borrado ni reinicio)

ALTER TABLE "CodigoFamiliar" 
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
ADD COLUMN IF NOT EXISTS "dniTutor" TEXT,
ADD COLUMN IF NOT EXISTS "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "hermanosConfirmados" BOOLEAN NOT NULL DEFAULT false;
