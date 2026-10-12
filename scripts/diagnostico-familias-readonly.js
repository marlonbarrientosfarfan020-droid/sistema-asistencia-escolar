const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * DIAGNÓSTICO DE SOLO LECTURA: AUDITORÍA DE ASOCIACIONES FAMILIARES
 * 
 * Uso:
 * 1. Contra Base de Datos: node scripts/diagnostico-familias-readonly.js [DATABASE_URL]
 * 2. Contra Archivo Backup JSON: node scripts/diagnostico-familias-readonly.js --file backups/backup_neon_completo_1791597402305.json
 */
async function main() {
  console.log('========================================================================');
  console.log('  DIAGNÓSTICO DE SOLO LECTURA: VÍNCULOS FAMILIARES (PORTAL DE PADRES)   ');
  console.log('========================================================================\n');

  const args = process.argv.slice(2);

  // Modo Archivo JSON
  if (args[0] === '--file' && args[1]) {
    const backupPath = path.resolve(args[1]);
    if (!fs.existsSync(backupPath)) {
      console.error(`Error: Archivo no encontrado: ${backupPath}`);
      process.exit(1);
    }
    console.log(`Analizando respaldo JSON: ${backupPath}\n`);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const familias = backup.tablas?.CodigoFamiliar || [];
    const estudiantes = backup.tablas?.Estudiante || [];
    analizarDatos(familias, estudiantes);
    return;
  }

  // Modo Base de Datos (PostgreSQL)
  let dbUrl = args[0];
  if (!dbUrl) {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^DATABASE_URL=(.+)$/m);
      if (match) dbUrl = match[1].replace(/["']/g, '').trim();
    }
  }

  if (!dbUrl) {
    console.error('Error: No se encontró DATABASE_URL ni se proporcionó como argumento.');
    process.exit(1);
  }

  const masked = dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`Conectando en MODO SOLO LECTURA a: ${masked}\n`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const resFamilias = await client.query('SELECT id, codigo, "tutorTitular", "telefonoContacto", estado FROM "CodigoFamiliar" ORDER BY id ASC');
    const resEstudiantes = await client.query('SELECT id, codigo, dni, nombres, apellidos, grado, seccion, "codigoFamiliarId", estado FROM "Estudiante" ORDER BY grado ASC, seccion ASC');

    analizarDatos(resFamilias.rows, resEstudiantes.rows);
  } finally {
    await client.end();
  }
}

function analizarDatos(familias, estudiantes) {
  console.log(`Total Códigos Familiares Registrados : ${familias.length}`);
  console.log(`Total Estudiantes en Padrón          : ${estudiantes.length}`);

  const estudiantesSinCodigo = estudiantes.filter(e => !e.codigoFamiliarId);
  const familiasConAnomalia = [];
  const familiasNormales = [];
  const familiasVacias = [];

  familias.forEach(f => {
    const asignados = estudiantes.filter(e => e.codigoFamiliarId === f.id);
    const info = {
      id: f.id,
      codigo: f.codigo,
      tutor: f.tutorTitular || '(Sin tutor registrado)',
      telefono: f.telefonoContacto || '',
      estado: f.estado,
      totalHijos: asignados.length,
      hijos: asignados,
    };

    if (asignados.length > 3) {
      familiasConAnomalia.push(info);
    } else if (asignados.length === 0) {
      familiasVacias.push(info);
    } else {
      familiasNormales.push(info);
    }
  });

  console.log(`Estudiantes Sin Código Familiar      : ${estudiantesSinCodigo.length}`);
  console.log(`Familias con Vínculos Normales (1-3) : ${familiasNormales.length}`);
  console.log(`Familias Huérfanas (0 estudiantes)   : ${familiasVacias.length}`);
  console.log(`Familias con ANOMALÍA (> 3 estudiantes): ${familiasConAnomalia.length}\n`);

  if (familiasConAnomalia.length > 0) {
    console.log('------------------------------------------------------------------------');
    console.log('  ⚠️ ALERTA DE SEGURIDAD: FAMILIAS CON AGRUPACIÓN ANORMAL (> 3 ESTUDIANTES)');
    console.log('------------------------------------------------------------------------');
    familiasConAnomalia.forEach(f => {
      console.log(`\n[ANOMALÍA DETECTADA] Código: ${f.codigo} | Tutor: ${f.tutor} | Total Estudiantes: ${f.totalHijos}`);
      
      // Conteo por grado y sección
      const porSeccion = {};
      f.hijos.forEach(h => {
        const key = `${h.grado} ${h.seccion}`;
        porSeccion[key] = (porSeccion[key] || 0) + 1;
      });
      console.log('  Distribución por Grado/Sección:', porSeccion);

      if (f.totalHijos <= 10) {
        console.log('  Estudiantes vinculados:');
        f.hijos.forEach(h => console.log(`    - ${h.nombres} ${h.apellidos} (${h.grado}-${h.seccion}, DNI: ${h.dni})`));
      } else {
        console.log(`  Muestra de los primeros 5 de ${f.totalHijos}:`);
        f.hijos.slice(0, 5).forEach(h => console.log(`    - ${h.nombres} ${h.apellidos} (${h.grado}-${h.seccion})`));
      }
    });
  }

  if (familiasVacias.length > 0) {
    console.log('\n------------------------------------------------------------------------');
    console.log('  CÓDIGOS FAMILIARES SIN ESTUDIANTES ASIGNADOS (CÓDIGOS HUÉRFANOS)');
    console.log('------------------------------------------------------------------------');
    familiasVacias.forEach(f => {
      console.log(`  - Código: ${f.codigo} | Tutor: ${f.tutor}`);
    });
  }

  console.log('\n========================================================================');
  console.log('  DICTAMEN DEL DIAGNÓSTICO:');
  if (familiasConAnomalia.length > 0) {
    console.log('  ❌ NO APTO PARA HABILITACIÓN PÚBLICA DEL PORTAL DE PADRES.');
    console.log('  Motivo: Existen códigos con vinculación masiva errónea.');
    console.log('  Acción: Regularizar antes de enviar credenciales a apoderados.');
  } else {
    console.log('  ✅ APTO: No se detectaron agrupaciones masivas anómalas.');
  }
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('Error durante el diagnóstico:', err);
  process.exit(1);
});
