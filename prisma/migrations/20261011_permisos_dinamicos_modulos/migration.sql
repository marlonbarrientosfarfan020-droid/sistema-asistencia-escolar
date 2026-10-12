-- Migración Aditiva: Tabla UsuarioModulo para Control Dinámico de los 23 Módulos Operativos
-- 100% reversible, aditiva y compatible con roles preexistentes

CREATE TABLE IF NOT EXISTS "UsuarioModulo" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "modulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioModulo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UsuarioModulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioModulo_usuarioId_modulo_key" ON "UsuarioModulo"("usuarioId", "modulo");
CREATE INDEX IF NOT EXISTS "UsuarioModulo_usuarioId_idx" ON "UsuarioModulo"("usuarioId");
CREATE INDEX IF NOT EXISTS "UsuarioModulo_modulo_idx" ON "UsuarioModulo"("modulo");
