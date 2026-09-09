import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function migrarMulticolegio() {
  console.log('==================================================');
  console.log('FASE 8.2: MIGRACIÓN Y ASEGURAMIENTO MULTICOLEGIO');
  console.log('==================================================');

  // 1. Asegurar Colegio Institucional Base (Santa Rita de Casia)
  const colegioBase = await prisma.colegio.upsert({
    where: { codigo: 'SANTA_RITA_001' },
    update: {
      nombre: 'I.E. Santa Rita de Casia',
      nombreCorto: 'Santa Rita',
      direccion: 'Cañete, Lima, Perú',
      estado: 'ACTIVO',
    },
    create: {
      codigo: 'SANTA_RITA_001',
      nombre: 'I.E. Santa Rita de Casia',
      nombreCorto: 'Santa Rita',
      direccion: 'Cañete, Lima, Perú',
      telefono: '01-581-2345',
      estado: 'ACTIVO',
    },
  });
  console.log('✓ Colegio Base verificado:', colegioBase.codigo, '-', colegioBase.nombre);

  // 2. Asegurar segundo colegio para pruebas y aislamiento (Colegio San José)
  const colegioSecundario = await prisma.colegio.upsert({
    where: { codigo: 'COLEGIO_SAN_JOSE_002' },
    update: {
      nombre: 'Colegio San José de Cañete',
      nombreCorto: 'San José',
      estado: 'ACTIVO',
    },
    create: {
      codigo: 'COLEGIO_SAN_JOSE_002',
      nombre: 'Colegio San José de Cañete',
      nombreCorto: 'San José',
      direccion: 'San Vicente, Cañete, Perú',
      telefono: '01-581-9876',
      estado: 'ACTIVO',
    },
  });
  console.log('✓ Colegio Secundario verificado:', colegioSecundario.codigo, '-', colegioSecundario.nombre);

  // 3. Crear SistemaControl independiente para COLEGIO_SAN_JOSE_002 si no existe
  const scSanJose = await prisma.sistemaControl.upsert({
    where: { colegioId: 'COLEGIO_SAN_JOSE_002' },
    update: {},
    create: {
      colegioId: 'COLEGIO_SAN_JOSE_002',
      motorActivo: false,
      asistenciaActivo: false,
      telegramActivo: false,
      whatsappActivo: false,
      portalActivo: false,
      reportesActivo: false,
      iaActivo: false,
      alertasActivo: false,
      estadoJornada: 'CERRADO',
      modoOperacion: 'MANUAL',
      ultimoUsuario: 'SISTEMA_MIGRACION',
    },
  });
  console.log('✓ SistemaControl para San José listo (ID:', scSanJose.id, 'Motor:', scSanJose.motorActivo, ')');

  // 4. Crear Configuracion independiente para COLEGIO_SAN_JOSE_002 si no existe
  await prisma.configuracion.upsert({
    where: { colegioId: 'COLEGIO_SAN_JOSE_002' },
    update: {},
    create: {
      colegioId: 'COLEGIO_SAN_JOSE_002',
      nombreColegio: 'Colegio San José de Cañete',
      direccion: 'San Vicente, Cañete, Perú',
      telefono: '01-581-9876',
      correo: 'contacto@sanjose.edu.pe',
      director: 'Prof. Carlos Ramírez',
      canalTelegramActivo: false,
      canalWhatsAppActivo: false,
    },
  });
  console.log('✓ Configuración independiente para San José lista.');

  // 5. Crear Turno independiente para San José si no existe
  await prisma.turno.upsert({
    where: {
      colegioId_nombre: {
        colegioId: 'COLEGIO_SAN_JOSE_002',
        nombre: 'Turno Mañana San José',
      },
    },
    update: {},
    create: {
      colegioId: 'COLEGIO_SAN_JOSE_002',
      nombre: 'Turno Mañana San José',
      horaEntrada: '07:30',
      horaSalida: '14:00',
      estado: true,
    },
  });
  console.log('✓ Turno independiente para San José listo.');

  console.log('==================================================');
  console.log('MIGRACIÓN FASE 8 MULTICOLEGIO COMPLETADA CON ÉXITO');
  console.log('==================================================');
}

migrarMulticolegio()
  .catch((e) => {
    console.error('Error en migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
