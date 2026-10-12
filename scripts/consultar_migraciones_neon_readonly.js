const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * CONSULTA DE SOLO LECTURA: ESTADO DE _prisma_migrations
 * 
 * Uso: node scripts/consultar_migraciones_neon_readonly.js [DATABASE_URL]
 * Garantía: Abre una transacción estricta 'BEGIN READ ONLY' y hace ROLLBACK. Cero escrituras.
 */
async function main() {
  console.log('========================================================================');
  console.log('  CONSULTA DE SOLO LECTURA: _prisma_migrations EN BASE DE DATOS         ');
  console.log('========================================================================\n');

  let dbUrl = process.env.NEON_DIRECT_URL || process.argv[2];
  if (!dbUrl) {
    require('dotenv').config();
    dbUrl = process.env.DATABASE_URL;
  }

  if (!dbUrl) {
    console.error('Error: Debe proveer la DATABASE_URL como argumento.');
    process.exit(1);
  }

  const masked = dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`Conectando en MODO ESTRICTO DE SOLO LECTURA a:\n  ${masked}\n`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Transacción de solo lectura garantizada
    await client.query('BEGIN READ ONLY;');

    // Obtener migraciones del repositorio
    const migrationsDir = path.resolve('prisma/migrations');
    const repoMigrations = fs
      .readdirSync(migrationsDir)
      .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort();

    console.log(`Migraciones en el repositorio local (${repoMigrations.length}):`);
    repoMigrations.forEach((m, idx) => console.log(`  ${idx + 1}. ${m}`));

    // Consultar _prisma_migrations en la base de datos
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('\n⚠️ La tabla _prisma_migrations NO existe aún en esta base de datos.');
      console.log('Estado: Todas las migraciones están pendientes.');
      await client.query('ROLLBACK;');
      return;
    }

    const res = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at, applied_steps_count 
      FROM "_prisma_migrations" 
      ORDER BY started_at ASC;
    `);

    const dbMigrations = res.rows.map((r) => r.migration_name);

    console.log(`\nMigraciones registradas en la base de datos (${dbMigrations.length}):`);
    res.rows.forEach((r, idx) => {
      const estado = r.rolled_back_at ? '❌ REVERTIDA' : r.finished_at ? '✓ APLICADA' : '⏳ EN PROGRESO';
      console.log(`  ${idx + 1}. ${r.migration_name} [${estado}] (${r.finished_at ? r.finished_at.toISOString() : 'N/A'})`);
    });

    // Comparar diferencias
    const pendientes = repoMigrations.filter((m) => !dbMigrations.includes(m));
    const extrasEnDb = dbMigrations.filter((m) => !repoMigrations.includes(m));

    console.log('\n------------------------------------------------------------------------');
    console.log('RESUMEN DE ESTADO:');
    console.log(`  - Migraciones ya aplicadas : ${dbMigrations.length}`);
    console.log(`  - Migraciones PENDIENTES   : ${pendientes.length}`);

    if (pendientes.length > 0) {
      console.log('\nMigraciones pendientes por aplicar con "prisma migrate deploy":');
      pendientes.forEach((p, idx) => console.log(`  👉 [PENDIENTE ${idx + 1}] ${p}`));
    } else {
      console.log('\n✓ La base de datos está completamente al día con el repositorio.');
    }

    if (extrasEnDb.length > 0) {
      console.log('\n⚠️ Migraciones en DB no encontradas en local:', extrasEnDb);
    }

    await client.query('ROLLBACK;');
    console.log('\n========================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('Error durante la consulta:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
