import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function preMigracion() {
  console.log('[PRE-MIGRACION] Creando tabla Colegio y sembrando registro base...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Colegio" (
      "id" SERIAL NOT NULL,
      "codigo" TEXT NOT NULL,
      "nombre" TEXT NOT NULL,
      "nombreCorto" TEXT NOT NULL DEFAULT '',
      "direccion" TEXT NOT NULL DEFAULT '',
      "telefono" TEXT NOT NULL DEFAULT '',
      "logo" TEXT NOT NULL DEFAULT '',
      "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
      "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Colegio_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Colegio_codigo_key" ON "Colegio"("codigo");
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Colegio" ("codigo", "nombre", "nombreCorto", "direccion", "estado")
    VALUES ('SANTA_RITA_001', 'I.E. Santa Rita de Casia', 'Santa Rita', 'Cañete, Lima', 'ACTIVO')
    ON CONFLICT ("codigo") DO NOTHING;
  `);

  console.log('[PRE-MIGRACION] Colegio SANTA_RITA_001 asegurado con éxito en la base de datos.');
}

preMigracion()
  .catch((e) => {
    console.error('Error en pre-migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
