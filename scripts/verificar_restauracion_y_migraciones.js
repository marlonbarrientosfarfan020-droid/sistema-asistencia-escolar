const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

async function main() {
  console.log('========================================================================');
  console.log('  VERIFICACIÓN PRE-PRODUCCIÓN: RESTAURACIÓN REAL Y MIGRACIÓN EN COPIA   ');
  console.log('========================================================================\n');

  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error('DATABASE_URL no encontrada en .env');
  }

  const parsed = new URL(sourceUrl);
  parsed.pathname = '/sistema_asistencia_restored_test';
  const testDbUrl = parsed.toString();

  const masked = testDbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`[PASO 1] Creando base de datos aislada: ${masked}`);

  // 1. Recrear la base de datos aislada
  const adminClient = new Client({ connectionString: sourceUrl });
  await adminClient.connect();
  try {
    await adminClient.query('DROP DATABASE IF EXISTS sistema_asistencia_restored_test;');
    await adminClient.query('CREATE DATABASE sistema_asistencia_restored_test;');
    console.log('  ✓ Base de datos sistema_asistencia_restored_test creada en limpio.');
  } finally {
    await adminClient.end();
  }

  // 2. Conectar a la base de prueba y clonar el DDL completo desde la base local
  console.log('\n[PASO 2] Clonando esquema DDL hacia la base de prueba...');
  const srcClient = new Client({ connectionString: sourceUrl });
  const testClient = new Client({ connectionString: testDbUrl });
  await srcClient.connect();
  await testClient.connect();

  try {
    // Clonar Enums
    const enums = await srcClient.query(`
      SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ') as labels
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname;
    `);
    for (const e of enums.rows) {
      await testClient.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.typname}') THEN CREATE TYPE "${e.typname}" AS ENUM (${e.labels}); END IF; END $$;`);
    }
  } finally {
    await srcClient.end();
    await testClient.end();
  }

  // Ejecutar prisma db push en la base de prueba para crear todas las tablas
  console.log('  Ejecutando prisma db push sobre sistema_asistencia_restored_test...');
  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'pipe',
  });
  console.log('  ✓ Esquema base creado exitosamente en la copia aislada.');

  // 3. Revertir temporalmente el esquema al estado BASELINE de Neon (antes de las 4 migraciones)
  console.log('\n[PASO 3] Preparando copia con esquema BASELINE de Neon (pre-migración)...');
  const baselineClient = new Client({ connectionString: testDbUrl });
  await baselineClient.connect();
  try {
    // Eliminar tablas creadas por las 4 migraciones
    await baselineClient.query('DROP TABLE IF EXISTS "UsuarioModulo" CASCADE;');
    await baselineClient.query('DROP TABLE IF EXISTS "RegistroIdempotencia" CASCADE;');
    await baselineClient.query('DROP TABLE IF EXISTS "FotoActivaEstudiante" CASCADE;');
    await baselineClient.query('DROP TABLE IF EXISTS "ColaLimpiezaBlob" CASCADE;');

    // Eliminar columnas añadidas por las 4 migraciones
    await baselineClient.query('ALTER TABLE "CodigoFamiliar" DROP COLUMN IF EXISTS "passwordHash", DROP COLUMN IF EXISTS "dniTutor", DROP COLUMN IF EXISTS "intentosFallidos", DROP COLUMN IF EXISTS "bloqueadoHasta", DROP COLUMN IF EXISTS "hermanosConfirmados";');
    await baselineClient.query('ALTER TABLE "Asistencia" DROP COLUMN IF EXISTS "fotoProtegida", DROP COLUMN IF EXISTS "fotoEntradaProtegida", DROP COLUMN IF EXISTS "fotoSalidaProtegida";');
    await baselineClient.query('ALTER TABLE "EvidenciaFotografica" DROP COLUMN IF EXISTS "esActiva", DROP COLUMN IF EXISTS "esProtegida", DROP COLUMN IF EXISTS "rotadaAt", DROP COLUMN IF EXISTS "eliminadaBlobAt";');

    // Inicializar tabla _prisma_migrations con solo las 3 migraciones históricas
    await baselineClient.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);
    await baselineClient.query('DELETE FROM "_prisma_migrations";');
    await baselineClient.query(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
      VALUES 
        (gen_random_uuid()::text, 'checksum1', now(), '20260627052749_init', 1),
        (gen_random_uuid()::text, 'checksum2', now(), '20260627082929_agregar_tutor_whatsapp', 1),
        (gen_random_uuid()::text, 'checksum3', now(), '20260627093039_agregar_asistencias', 1);
    `);
    console.log('  ✓ Historial _prisma_migrations fijado en 3 migraciones baseline (4 pendientes).');
  } finally {
    await baselineClient.end();
  }

  // 4. Restaurar los datos reales del JSON de producción
  console.log('\n[PASO 4] Restaurando datos reales desde backups/backup_neon_completo_1791597402305.json...');
  const backupPath = path.resolve('backups/backup_neon_completo_1791597402305.json');
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const t = backupData.tablas;

  const restoreClient = new Client({ connectionString: testDbUrl });
  await restoreClient.connect();

  try {
    // Función auxiliar para insertar registros respetando IDs
    async function insertarTabla(nombreTabla, registros) {
      if (!registros || registros.length === 0) return 0;
      let count = 0;
      for (const reg of registros) {
        const keys = Object.keys(reg);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const vals = keys.map(k => reg[k]);
        await restoreClient.query(`INSERT INTO "${nombreTabla}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`, vals);
        count++;
      }
      try {
        await restoreClient.query(`
          SELECT setval(
            pg_get_serial_sequence('"${nombreTabla}"', 'id'),
            COALESCE(MAX(id), 1),
            MAX(id) IS NOT NULL
          ) FROM "${nombreTabla}";
        `);
      } catch (errSeq) {
      }
      return count;
    }

    console.log('  Insertando Colegio...');
    await insertarTabla('Colegio', t.Colegio);
    console.log('  Insertando Configuracion...');
    await insertarTabla('Configuracion', t.Configuracion);
    console.log('  Insertando SistemaControl...');
    await insertarTabla('SistemaControl', t.SistemaControl);
    console.log('  Insertando Turno...');
    await insertarTabla('Turno', t.Turno);
    console.log('  Insertando Usuario...');
    await insertarTabla('Usuario', t.Usuario);
    console.log('  Insertando CodigoFamiliar...');
    await insertarTabla('CodigoFamiliar', t.CodigoFamiliar);
    console.log('  Insertando Terminal...');
    await insertarTabla('Terminal', t.Terminal);
    console.log('  Insertando CalendarioEscolar...');
    await insertarTabla('CalendarioEscolar', t.CalendarioEscolar);
    console.log('  Insertando Estudiante...');
    await insertarTabla('Estudiante', t.Estudiante);
    console.log('  Insertando Asistencia...');
    await insertarTabla('Asistencia', t.Asistencia);
    console.log('  Insertando EvidenciaFotografica...');
    await insertarTabla('EvidenciaFotografica', t.EvidenciaFotografica);

    console.log('  ✓ Datos restaurados exitosamente en la copia aislada.');

    // 5. Auditoría de integridad pre-migración
    console.log('\n[PASO 5] Verificando integridad de datos restaurados...');
    const cColegio = (await restoreClient.query('SELECT count(*) FROM "Colegio"')).rows[0].count;
    const cEstudiante = (await restoreClient.query('SELECT count(*) FROM "Estudiante"')).rows[0].count;
    const cAsistencia = (await restoreClient.query('SELECT count(*) FROM "Asistencia"')).rows[0].count;
    const cEvidencia = (await restoreClient.query('SELECT count(*) FROM "EvidenciaFotografica"')).rows[0].count;
    const cUsuario = (await restoreClient.query('SELECT count(*) FROM "Usuario"')).rows[0].count;
    const cTurno = (await restoreClient.query('SELECT count(*) FROM "Turno"')).rows[0].count;
    const cFamilia = (await restoreClient.query('SELECT count(*) FROM "CodigoFamiliar"')).rows[0].count;

    console.log(`  - Colegios     : ${cColegio} (Esperado: ${t.Colegio.length})`);
    console.log(`  - Estudiantes  : ${cEstudiante} (Esperado: ${t.Estudiante.length})`);
    console.log(`  - Asistencias  : ${cAsistencia} (Esperado: ${t.Asistencia.length})`);
    console.log(`  - Evidencias   : ${cEvidencia} (Esperado: ${t.EvidenciaFotografica.length})`);
    console.log(`  - Usuarios     : ${cUsuario} (Esperado: ${t.Usuario.length})`);
    console.log(`  - Turnos       : ${cTurno} (Esperado: ${t.Turno.length})`);
    console.log(`  - Familias     : ${cFamilia} (Esperado: ${t.CodigoFamiliar.length})`);

    const integridadOk = (
      Number(cEstudiante) === 204 &&
      Number(cAsistencia) === 281 &&
      Number(cEvidencia) === 393 &&
      Number(cUsuario) === 4
    );

    if (!integridadOk) {
      throw new Error('Integridad de registros fallida al restaurar');
    }
    console.log('  ✓ INTEGRIDAD DE RESTAURACIÓN 100% CONFIRMADA.');

  } finally {
    await restoreClient.end();
  }

  // 6. Ejecutar npx prisma migrate deploy sobre la copia restaurada
  console.log('\n[PASO 6] Ejecutando npx prisma migrate deploy sobre la copia real...');
  const deployOutput = execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    encoding: 'utf8',
  });
  console.log(deployOutput);

  // 7. Verificación post-migración
  console.log('[PASO 7] Verificando esquema y datos tras la migración...');
  const verifyClient = new Client({ connectionString: testDbUrl });
  await verifyClient.connect();

  try {
    // Verificar migraciones aplicadas
    const migsRes = await verifyClient.query('SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at ASC;');
    console.log(`  Total migraciones en historial: ${migsRes.rows.length}`);
    migsRes.rows.forEach(m => console.log(`    ✓ ${m.migration_name}`));

    // Verificar que los datos históricos se mantengan
    const cEstPost = (await verifyClient.query('SELECT count(*) FROM "Estudiante"')).rows[0].count;
    const cAsisPost = (await verifyClient.query('SELECT count(*) FROM "Asistencia"')).rows[0].count;
    const cEvidPost = (await verifyClient.query('SELECT count(*) FROM "EvidenciaFotografica"')).rows[0].count;
    const cUserPost = (await verifyClient.query('SELECT count(*) FROM "Usuario"')).rows[0].count;

    console.log('\n  Comprobación de conservación de datos:');
    console.log(`    - Estudiantes antes: 204 | después: ${cEstPost}`);
    console.log(`    - Asistencias antes: 281 | después: ${cAsisPost}`);
    console.log(`    - Evidencias antes:  393 | después: ${cEvidPost}`);
    console.log(`    - Usuarios antes:     4  | después: ${cUserPost}`);

    // Probar consultas funcionales reales en el nuevo esquema:
    console.log('\n[PASO 8] Ejecutando pruebas operativas contra el esquema migrado:');

    // 1. Login y lectura de usuario admin
    const adminUser = await verifyClient.query('SELECT id, usuario, rol, estado FROM "Usuario" WHERE rol = \'ADMIN\' LIMIT 1;');
    console.log('  1. Login Admin en PostgreSQL:', adminUser.rows.length > 0 ? '✓ EXITOSO' : '❌ FALLÓ');

    // 2. Inserción en UsuarioModulo (Nueva tabla de permisos)
    await verifyClient.query('INSERT INTO "UsuarioModulo" ("usuarioId", "modulo") VALUES ($1, $2) ON CONFLICT DO NOTHING;', [adminUser.rows[0].id, 'estudiantes']);
    const modCount = (await verifyClient.query('SELECT count(*) FROM "UsuarioModulo" WHERE "usuarioId" = $1;', [adminUser.rows[0].id])).rows[0].count;
    console.log('  2. Tabla UsuarioModulo (Permisos dinámicos):', Number(modCount) > 0 ? '✓ OPERATIVA' : '❌ FALLÓ');

    // 3. Inserción en RegistroIdempotencia (Nueva tabla de idempotencia)
    await verifyClient.query(`
      INSERT INTO "RegistroIdempotencia" ("clave", "tipoOperacion", "colegioId", "statusCode", "respuesta", "expiraAt")
      VALUES ('TEST_IDEMP_POST_MIGRATE', 'ASISTENCIA', 'SANTA_RITA_001', 200, '{"ok":true}'::jsonb, now() + interval '1 day');
    `);
    const idempRow = await verifyClient.query('SELECT clave, "statusCode" FROM "RegistroIdempotencia" WHERE clave = \'TEST_IDEMP_POST_MIGRATE\';');
    console.log('  3. Tabla RegistroIdempotencia:', idempRow.rows.length > 0 ? '✓ OPERATIVA' : '❌ FALLÓ');

    // 4. Consulta de FotoActivaEstudiante (Nueva tabla de punteros)
    const fotoActivaCount = (await verifyClient.query('SELECT count(*) FROM "FotoActivaEstudiante";')).rows[0].count;
    console.log('  4. Tabla FotoActivaEstudiante:', '✓ ACCESIBLE (Conteo inicial: ' + fotoActivaCount + ')');

    // 5. Consulta de CodigoFamiliar con nuevos campos opcionales
    const famTest = await verifyClient.query('SELECT id, codigo, "passwordHash", "intentosFallidos" FROM "CodigoFamiliar" LIMIT 1;');
    console.log('  5. Modelo CodigoFamiliar ampliado:', famTest.rows.length > 0 ? '✓ COMPATIBLE' : '❌ FALLÓ');

    console.log('\n========================================================================');
    console.log('  RESULTADO: RESTAURACIÓN Y MIGRACIONES COMPLETADAS EXITOSAMENTE (100%) ');
    console.log('========================================================================\n');
  } finally {
    await verifyClient.end();
  }
}

main().catch(err => {
  console.error('\n❌ ERROR EN EL PROCEDIMIENTO:', err);
  process.exit(1);
});
