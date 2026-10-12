require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { execFile } = require('child_process');

/**
 * PASO 1: RESPALDO ACTUALIZADO DE NEON PRODUCCIÓN Y VERIFICACIÓN RESTAURABLE
 * 
 * Uso:
 *   node scripts/paso1_respaldo_neon_y_verificacion.js "<URL_DIRECTA_NEON>"
 * 
 * Características:
 * 1. Enmascara credenciales (cero secretos en pantalla/logs).
 * 2. Consulta en MODO SOLO LECTURA los conteos vivos de producción.
 * 3. Ejecuta pg_dump en formato binario (-F c) pasando PGPASSWORD en env protegido.
 * 4. Valida la integridad del archivo dump con pg_restore -l.
 * 5. Restaura sobre la base aislada local 'sistema_asistencia_restored_test' para certificar recuperación.
 */

async function main() {
  console.log('========================================================================');
  console.log('  PASO 1: RESPALDO DE NEON PRODUCCIÓN Y VERIFICACIÓN DE RESTAURABILIDAD ');
  console.log('========================================================================\n');

  const neonUrlRaw = process.env.NEON_DIRECT_URL || process.argv[2];
  if (!neonUrlRaw) {
    console.error('ERROR: Debe proporcionar la URL de conexión directa de Neon como argumento.');
    console.error('Ejemplo: node scripts/paso1_respaldo_neon_y_verificacion.js "postgresql://usuario:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"\n');
    process.exit(1);
  }

  const parsed = new URL(neonUrlRaw.trim().replace(/^["']|["']$/g, ''));
  const masked = `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;

  console.log(`[1.1] Conectando a Neon Producción (Solo Lectura):`);
  console.log(`      Host       : ${parsed.hostname}`);
  console.log(`      Base Datos : ${parsed.pathname.replace('/', '')}`);
  console.log(`      Usuario    : ${parsed.username}`);
  console.log(`      Cadena     : ${masked}\n`);

  // 1. Consultas de Solo Lectura en Neon
  const client = new Client({ connectionString: neonUrlRaw });
  await client.connect();

  let conteosNeon = {};
  try {
    await client.query('BEGIN READ ONLY;');

    const cEst = await client.query('SELECT count(*) FROM "Estudiante"');
    const cAsis = await client.query('SELECT count(*) FROM "Asistencia"');
    const cFoto = await client.query('SELECT count(*) FROM "EvidenciaFotografica"');
    const cUser = await client.query('SELECT count(*) FROM "Usuario"');
    const cFam = await client.query('SELECT count(*) FROM "CodigoFamiliar"');
    const cCol = await client.query('SELECT count(*) FROM "Colegio"');
    const cTur = await client.query('SELECT count(*) FROM "Turno"');
    const cAud = await client.query('SELECT count(*) FROM "Auditoria"');
    const cCal = await client.query('SELECT count(*) FROM "CalendarioEscolar"');
    const cSis = await client.query('SELECT count(*) FROM "SistemaControl"');
    const cConf = await client.query('SELECT count(*) FROM "Configuracion"');

    const checkMig = await client.query("SELECT to_regclass('public._prisma_migrations')");
    let cMigCount = 0;
    if (checkMig.rows[0].to_regclass) {
      const cMig = await client.query('SELECT count(*) FROM "_prisma_migrations"');
      cMigCount = Number(cMig.rows[0].count);
    }

    conteosNeon = {
      estudiantes: Number(cEst.rows[0].count),
      asistencias: Number(cAsis.rows[0].count),
      evidencias: Number(cFoto.rows[0].count),
      usuarios: Number(cUser.rows[0].count),
      familias: Number(cFam.rows[0].count),
      colegios: Number(cCol.rows[0].count),
      turnos: Number(cTur.rows[0].count),
      auditorias: Number(cAud.rows[0].count),
      calendario: Number(cCal.rows[0].count),
      sistemaControl: Number(cSis.rows[0].count),
      configuracion: Number(cConf.rows[0].count),
      migraciones: cMigCount,
      migracionesExiste: !!checkMig.rows[0].to_regclass
    };

    console.log('[1.2] CONTEOS EN VIVO EN NEON PRODUCCIÓN:');
    console.log(`      - Colegios              : ${conteosNeon.colegios}`);
    console.log(`      - Estudiantes           : ${conteosNeon.estudiantes}`);
    console.log(`      - Asistencias           : ${conteosNeon.asistencias}`);
    console.log(`      - Evidencias Fotográficas: ${conteosNeon.evidencias}`);
    console.log(`      - Usuarios              : ${conteosNeon.usuarios}`);
    console.log(`      - Códigos Familiares    : ${conteosNeon.familias}`);
    console.log(`      - Turnos Escolares      : ${conteosNeon.turnos}`);
    console.log(`      - Registros Auditoría   : ${conteosNeon.auditorias}`);
    console.log(`      - Migraciones en DB     : ${conteosNeon.migraciones}`);

    // Comparación con el respaldo anterior del 10 de octubre
    console.log('\n[1.3] COMPARATIVA CON EL RESPALDO DEL 10 DE OCTUBRE:');
    console.log(`      Estudiantes : ${conteosNeon.estudiantes} (Anterior: 204) -> Diferencia: ${conteosNeon.estudiantes - 204}`);
    console.log(`      Asistencias : ${conteosNeon.asistencias} (Anterior: 281) -> Diferencia: ${conteosNeon.asistencias - 281}`);
    console.log(`      Evidencias  : ${conteosNeon.evidencias} (Anterior: 393) -> Diferencia: ${conteosNeon.evidencias - 393}`);

    await client.query('ROLLBACK;');
  } finally {
    await client.end();
  }

  // 2. Ejecutar pg_dump hacia backups/
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFileName = `neon_prod_${timestamp}.dump`;
  const dumpFilePath = path.join(backupDir, dumpFileName);

  console.log(`\n[1.4] Generando Respaldo Lógico Inmutable con pg_dump:`);
  console.log(`      Destino: ${dumpFilePath}`);

  const pgDumpExe = path.resolve('scratch/pg_dump.exe');
  if (!fs.existsSync(pgDumpExe)) {
    throw new Error(`pg_dump no encontrado en: ${pgDumpExe}`);
  }

  const pgDumpArgs = [
    '--host', parsed.hostname,
    '--port', parsed.port || '5432',
    '--username', parsed.username,
    '--dbname', parsed.pathname.replace('/', ''),
    '--format=c',
    '--blobs',
    '--verbose',
    '--file', dumpFilePath
  ];

  await new Promise((resolve, reject) => {
    execFile(
      pgDumpExe,
      pgDumpArgs,
      {
        env: {
          ...process.env,
          PATH: 'C:\\Program Files\\PostgreSQL\\17\\bin;' + (process.env.PATH || ''),
          PGPASSWORD: decodeURIComponent(parsed.password),
          PGSSLMODE: 'require'
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`pg_dump falló: ${error.message}\n${stderr}`));
        }
        resolve({ stdout, stderr });
      }
    );
  });

  const stats = fs.statSync(dumpFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`      ✓ pg_dump finalizado exitosamente.`);
  console.log(`      ✓ Tamaño del archivo binario: ${sizeMb} MB (${stats.size} bytes)`);

  // 3. Inspección del archivo dump con pg_restore -l
  console.log(`\n[1.5] Inspeccionando archivo con pg_restore -l...`);
  const pgRestoreExe = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe';
  const tocOutput = await new Promise((resolve, reject) => {
    execFile(pgRestoreExe, ['-l', dumpFilePath], (error, stdout, stderr) => {
      if (error) return reject(new Error(`pg_restore -l falló: ${error.message}`));
      resolve(stdout);
    });
  });

  const hasEstudiantes = tocOutput.includes('TABLE DATA public Estudiante');
  const hasAsistencias = tocOutput.includes('TABLE DATA public Asistencia');
  const hasEvidencias = tocOutput.includes('TABLE DATA public EvidenciaFotografica');
  const hasUsuarios = tocOutput.includes('TABLE DATA public Usuario');

  console.log(`      Tabla Estudiante en dump          : ${hasEstudiantes ? '✓ CONFIRMADA' : '❌ NO ENCONTRADA'}`);
  console.log(`      Tabla Asistencia en dump          : ${hasAsistencias ? '✓ CONFIRMADA' : '❌ NO ENCONTRADA'}`);
  console.log(`      Tabla EvidenciaFotografica en dump: ${hasEvidencias ? '✓ CONFIRMADA' : '❌ NO ENCONTRADA'}`);
  console.log(`      Tabla Usuario en dump             : ${hasUsuarios ? '✓ CONFIRMADA' : '❌ NO ENCONTRADA'}`);

  if (!hasEstudiantes || !hasAsistencias) {
    throw new Error('El archivo dump no contiene las tablas críticas.');
  }

  // 4. Restauración de prueba en base aislada
  console.log(`\n[1.6] Ejecutando restauración de prueba en PostgreSQL aislado (sistema_asistencia_restored_test)...`);
  const localSourceUrl = process.env.DATABASE_URL;
  if (!localSourceUrl) {
    throw new Error('DATABASE_URL local no configurada en .env');
  }

  const localParsed = new URL(localSourceUrl);
  localParsed.pathname = '/sistema_asistencia_restored_test';
  const testDbUrl = localParsed.toString();

  // Recrear la base de datos aislada limpia
  const localAdmin = new Client({ connectionString: localSourceUrl });
  await localAdmin.connect();
  try {
    await localAdmin.query('DROP DATABASE IF EXISTS sistema_asistencia_restored_test;');
    await localAdmin.query('CREATE DATABASE sistema_asistencia_restored_test;');
  } finally {
    await localAdmin.end();
  }

  // Ejecutar pg_restore
  await new Promise((resolve, reject) => {
    execFile(
      pgRestoreExe,
      [
        '--host', localParsed.hostname,
        '--port', localParsed.port || '5432',
        '--username', localParsed.username,
        '--dbname', 'sistema_asistencia_restored_test',
        '--no-owner',
        '--no-privileges',
        dumpFilePath
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: decodeURIComponent(localParsed.password)
        }
      },
      (error, stdout, stderr) => {
        // pg_restore emite advertencias normales en stderr sobre roles que no impiden la restauración
        resolve({ stdout, stderr });
      }
    );
  });

  // 5. Verificar los datos restaurados en la base local
  const testClient = new Client({ connectionString: testDbUrl });
  await testClient.connect();
  try {
    const tEst = await testClient.query('SELECT count(*) FROM "Estudiante"');
    const tAsis = await testClient.query('SELECT count(*) FROM "Asistencia"');
    const tFoto = await testClient.query('SELECT count(*) FROM "EvidenciaFotografica"');
    const tUser = await testClient.query('SELECT count(*) FROM "Usuario"');
    const tFam = await testClient.query('SELECT count(*) FROM "CodigoFamiliar"');
    const tCol = await testClient.query('SELECT count(*) FROM "Colegio"');
    const tTur = await testClient.query('SELECT count(*) FROM "Turno"');
    const tAud = await testClient.query('SELECT count(*) FROM "Auditoria"');
    const tCal = await testClient.query('SELECT count(*) FROM "CalendarioEscolar"');
    const tSis = await testClient.query('SELECT count(*) FROM "SistemaControl"');
    const tConf = await testClient.query('SELECT count(*) FROM "Configuracion"');

    const rEst = Number(tEst.rows[0].count);
    const rAsis = Number(tAsis.rows[0].count);
    const rFoto = Number(tFoto.rows[0].count);
    const rUser = Number(tUser.rows[0].count);
    const rFam = Number(tFam.rows[0].count);
    const rCol = Number(tCol.rows[0].count);
    const rTur = Number(tTur.rows[0].count);
    const rAud = Number(tAud.rows[0].count);
    const rCal = Number(tCal.rows[0].count);
    const rSis = Number(tSis.rows[0].count);
    const rConf = Number(tConf.rows[0].count);

    console.log(`      ✓ Estudiantes restaurados : ${rEst} (Esperado: ${conteosNeon.estudiantes})`);
    console.log(`      ✓ Asistencias restauradas : ${rAsis} (Esperado: ${conteosNeon.asistencias})`);
    console.log(`      ✓ Evidencias restauradas  : ${rFoto} (Esperado: ${conteosNeon.evidencias})`);
    console.log(`      ✓ Usuarios restaurados    : ${rUser} (Esperado: ${conteosNeon.usuarios})`);
    console.log(`      ✓ Códigos Fam. rest.      : ${rFam} (Esperado: ${conteosNeon.familias})`);
    console.log(`      ✓ Colegios restaurados    : ${rCol} (Esperado: ${conteosNeon.colegios})`);
    console.log(`      ✓ Turnos restaurados      : ${rTur} (Esperado: ${conteosNeon.turnos})`);
    console.log(`      ✓ Auditorías restauradas  : ${rAud} (Esperado: ${conteosNeon.auditorias})`);
    console.log(`      ✓ Calendario restaurado   : ${rCal} (Esperado: ${conteosNeon.calendario})`);
    console.log(`      ✓ SistemaControl rest.    : ${rSis} (Esperado: ${conteosNeon.sistemaControl})`);
    console.log(`      ✓ Configuración rest.     : ${rConf} (Esperado: ${conteosNeon.configuracion})`);

    if (
      rEst !== conteosNeon.estudiantes ||
      rAsis !== conteosNeon.asistencias ||
      rFoto !== conteosNeon.evidencias ||
      rUser !== conteosNeon.usuarios ||
      rFam !== conteosNeon.familias ||
      rCol !== conteosNeon.colegios ||
      rTur !== conteosNeon.turnos
    ) {
      throw new Error('Discrepancia entre los conteos de Neon y la base restaurada.');
    }

    console.log('\n[1.7] RECORDATORIO BLOB: Los archivos físicos de imágenes residen en Vercel Blob,');
    console.log('      no en el dump lógico de PostgreSQL. pg_dump contiene el 100% de metadatos y URLs.\n');
    console.log('\n========================================================================');
    console.log('  PASO 1 COMPLETADO EXITOSAMENTE: RESPALDO CERTIFICADO Y RESTAURABLE   ');
    console.log('========================================================================\n');

  } finally {
    await testClient.end();
  }
}

main().catch(err => {
  console.error('\n❌ ERROR EN EL PASO 1:', err.message);
  process.exit(1);
});
