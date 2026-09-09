import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

async function crearRespaldo() {
  console.log('==================================================');
  console.log('FASE 8.9: CREANDO RESPALDO DE SEGURIDAD PRE-MIGRACIÓN');
  console.log('==================================================');

  const fechaIso = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `backup_pre_fase8_${fechaIso}.json`);

  const datos = {
    timestamp: new Date().toISOString(),
    sistemaControl: await prisma.sistemaControl.findMany(),
    usuarios: await prisma.usuario.findMany(),
    estudiantes: await prisma.estudiante.findMany(),
    turnos: await prisma.turno.findMany(),
    asistencias: await prisma.asistencia.findMany(),
    codigosFamiliares: await prisma.codigoFamiliar.findMany(),
    configuraciones: await prisma.configuracion.findMany(),
    calendarioEscolar: await prisma.calendarioEscolar.findMany(),
    historialReportes: await prisma.historialReporteAutomatico.findMany(),
    auditorias: await prisma.auditoria.findMany(),
  };

  fs.writeFileSync(backupFile, JSON.stringify(datos, null, 2), 'utf8');

  console.log(`✓ Respaldo guardado exitosamente en: ${backupFile}`);
  console.log('Resumen de registros respaldados:');
  console.log(` - SistemaControl: ${datos.sistemaControl.length}`);
  console.log(` - Usuarios: ${datos.usuarios.length}`);
  console.log(` - Estudiantes: ${datos.estudiantes.length}`);
  console.log(` - Turnos: ${datos.turnos.length}`);
  console.log(` - Asistencias: ${datos.asistencias.length}`);
  console.log(` - Códigos Familiares: ${datos.codigosFamiliares.length}`);
  console.log(` - Configuraciones: ${datos.configuraciones.length}`);
  console.log(` - Calendario Escolar: ${datos.calendarioEscolar.length}`);
  console.log(` - Historial Reportes: ${datos.historialReportes.length}`);
  console.log(` - Auditorías: ${datos.auditorias.length}`);
  console.log('==================================================');
}

crearRespaldo()
  .catch((e) => {
    console.error('Error generando respaldo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
