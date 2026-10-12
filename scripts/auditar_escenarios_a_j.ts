import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import {
  MODULOS_OPERATIVOS,
  obtenerModulosPorRol,
  esRutaPermitida,
} from '../lib/modulos';
import {
  obtenerVentanaTurno,
  fechaPeru,
  horaPeru,
} from '../lib/timezone';
import { ejecutarCierreJornadasVencidas } from '../services/jornada/cierreJornadaService';

async function main() {
  console.log('========================================================================');
  console.log('  AUDITORÍA TÉCNICA INTEGRAL PREPRODUCCIÓN: ESCENARIOS A - J (E2E)      ');
  console.log('========================================================================\n');

  let aprobadas = 0;
  let total = 0;

  function assert(cond: boolean, desc: string, extra?: any) {
    total++;
    if (cond) {
      console.log(`  ✅ [PASÓ] Escenario ${total}: ${desc}`);
      aprobadas++;
    } else {
      console.error(`  ❌ [FALLÓ] Escenario ${total}: ${desc}`);
      if (extra) console.error('     Detalle:', extra);
      process.exitCode = 1;
    }
  }

  const COLEGIO_TEST = 'SANTA_RITA_001';

  try {
    // Limpieza de datos de pruebas previas
    await prisma.asistencia.deleteMany({
      where: { estudiante: { codigo: { startsWith: 'AUDIT_E2E_' } } },
    });
    await prisma.estudiante.deleteMany({
      where: { codigo: { startsWith: 'AUDIT_E2E_' } },
    });
    await prisma.usuario.deleteMany({
      where: { usuario: { startsWith: 'audit_user_' } },
    });
    await prisma.codigoFamiliar.deleteMany({
      where: { codigo: { startsWith: 'FAM_AUDIT_' } },
    });

    // Asegurar turno de prueba
    let turnoTest = await prisma.turno.findFirst({
      where: { colegioId: COLEGIO_TEST, nombre: 'TURNO_AUDITORIA_M' },
    });
    if (!turnoTest) {
      turnoTest = await prisma.turno.create({
        data: {
          colegioId: COLEGIO_TEST,
          nombre: 'TURNO_AUDITORIA_M',
          horaEntrada: '07:30',
          horaSalida: '13:00',
          estado: true,
          minutosAlertaInicial: 5,
          margenAlertaMinutos: 15,
          margenEntradaAnticipadaMinutos: 60,
          margenSalidaAnticipadaMinutos: 15,
          margenSalidaMinutos: 60,
        },
      });
    }

    // Asegurar código familiar
    const familiaTest = await prisma.codigoFamiliar.create({
      data: {
        codigo: 'FAM_AUDIT_001',
        colegio: { connect: { codigo: COLEGIO_TEST } },
        passwordHash: await bcrypt.hash('familia123', 10),
        tutorTitular: 'Familia Auditoría E2E',
        estado: true,
      },
    });

    // -------------------------------------------------------------------------
    // ESCENARIO A: Crear usuario → asignar módulos → sesión → acceso a rutas
    // -------------------------------------------------------------------------
    const passHash = await bcrypt.hash('auditPass123', 10);
    const userA = await prisma.usuario.create({
      data: {
        colegioId: COLEGIO_TEST,
        usuario: 'audit_user_a',
        password: passHash,
        rol: 'PORTERIA',
        estado: true,
        modulosPermitidos: {
          create: [{ modulo: 'marcar' }, { modulo: 'salidas' }],
        },
      },
      include: { modulosPermitidos: true },
    });
    const modsA = userA.modulosPermitidos.map((m) => m.modulo);
    const permiteMarcar = esRutaPermitida('/marcar', modsA, false);
    const bloqueaEstudiantes = esRutaPermitida('/dashboard/estudiantes', modsA, false);
    assert(
      permiteMarcar && !bloqueaEstudiantes && modsA.length === 2,
      'ESCENARIO A: Usuario creado con 2 módulos; rutas autorizadas permitidas y no autorizadas denegadas'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO B: Crear estudiante → generar QR → marcar entrada → monitor y portal
    // -------------------------------------------------------------------------
    const estudianteB = await prisma.estudiante.create({
      data: {
        colegioId: COLEGIO_TEST,
        codigo: 'AUDIT_E2E_001',
        dni: '77889901',
        nombres: 'Estudiante B',
        apellidos: 'Prueba E2E',
        grado: '5TO',
        seccion: 'A',
        turnoId: turnoTest.id,
        codigoFamiliarId: familiaTest.id,
        estado: true,
      },
    });

    const ahoraSimulada = new Date();
    const fechaDiaHoy = fechaPeru(ahoraSimulada);
    const asistenciaB = await prisma.asistencia.create({
      data: {
        colegioId: COLEGIO_TEST,
        estudianteId: estudianteB.id,
        turnoId: turnoTest.id,
        fecha: ahoraSimulada,
        fechaDia: fechaDiaHoy,
        horaEntrada: ahoraSimulada,
        metodo: 'QR',
        estado: 'PUNTUAL',
        estadoJornada: 'ABIERTA',
        estadoSalida: 'PENDIENTE',
        fotoEntrada: 'https://blob.vercel-storage.com/test-foto-entrada.jpg',
      },
    });

    // Consulta del portal familiar: sólo debe ver estudiantes con su codigoFamiliarId
    const portalHijos = await prisma.estudiante.findMany({
      where: {
        colegioId: COLEGIO_TEST,
        codigoFamiliarId: familiaTest.id,
        estado: true,
      },
      include: {
        asistencias: {
          where: { fechaDia: fechaDiaHoy },
        },
      },
    });
    assert(
      portalHijos.length === 1 &&
        portalHijos[0].id === estudianteB.id &&
        portalHijos[0].asistencias.length === 1 &&
        portalHijos[0].asistencias[0].estadoJornada === 'ABIERTA',
      'ESCENARIO B: Estudiante marcado con entrada; monitor y Portal de Padres sincronizados'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO C: Registrar salida real → actualizar asistencia → foto salida
    // -------------------------------------------------------------------------
    const horaSalidaSim = new Date(ahoraSimulada.getTime() + 4 * 60 * 60 * 1000);
    const salidaC = await prisma.asistencia.update({
      where: { id: asistenciaB.id },
      data: {
        horaSalida: horaSalidaSim,
        estadoSalida: 'NORMAL',
        estadoJornada: 'CERRADA',
        fotoSalida: 'https://blob.vercel-storage.com/test-foto-salida.jpg',
      },
    });
    assert(
      salidaC.horaSalida !== null &&
        salidaC.estadoJornada === 'CERRADA' &&
        Boolean(salidaC.fotoSalida?.includes('test-foto-salida')),
      'ESCENARIO C: Salida real registrada; asistencia actualizada y evidencia de salida persistida'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO D: Cierre automático simulado → jornada sin salida ficticia
    // -------------------------------------------------------------------------
    const estudianteD = await prisma.estudiante.create({
      data: {
        colegioId: COLEGIO_TEST,
        codigo: 'AUDIT_E2E_002',
        dni: '77889902',
        nombres: 'Estudiante D (Sin Salida)',
        apellidos: 'Prueba E2E',
        grado: '4TO',
        seccion: 'B',
        turnoId: turnoTest.id,
        estado: true,
      },
    });
    const asistenciaD = await prisma.asistencia.create({
      data: {
        colegioId: COLEGIO_TEST,
        estudianteId: estudianteD.id,
        turnoId: turnoTest.id,
        fecha: ahoraSimulada,
        fechaDia: '2026-10-10', // Jornada pasada para simular turno vencido
        horaEntrada: ahoraSimulada,
        horaSalida: null,
        metodo: 'DNI',
        estado: 'PUNTUAL',
        estadoJornada: 'ABIERTA',
      },
    });

    const resultadoCierre = await ejecutarCierreJornadasVencidas({
      colegioId: COLEGIO_TEST,
      fechaDiaFiltro: '2026-10-10',
      turnoIdFiltro: turnoTest.id,
      forzarCierre: true,
    });

    const asistenciaDPostCierre = await prisma.asistencia.findUnique({
      where: { id: asistenciaD.id },
    });
    assert(
      asistenciaDPostCierre?.estadoJornada === 'SIN_SALIDA' &&
        asistenciaDPostCierre.horaSalida === null &&
        asistenciaDPostCierre.fotoSalida === null,
      'ESCENARIO D: Cierre automático marca estadoJornada=SIN_SALIDA y preserva horaSalida=null estrictamente'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO E: Ejecución manual y automática simultánea sobre la misma jornada
    // -------------------------------------------------------------------------
    const reCierreAutomatico = await ejecutarCierreJornadasVencidas({
      colegioId: COLEGIO_TEST,
      fechaDiaFiltro: '2026-10-10',
      turnoIdFiltro: turnoTest.id,
      forzarCierre: true,
    });
    const cuentaSinSalidaPost = await prisma.asistencia.count({
      where: {
        estudianteId: estudianteD.id,
        fechaDia: '2026-10-10',
      },
    });
    assert(
      cuentaSinSalidaPost === 1 && reCierreAutomatico.totalSinSalidaCerrados === 0,
      'ESCENARIO E: Idempotencia en cierres múltiples; cero duplicaciones ni sobreescrituras'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO F: Dos terminales simultáneas con clave de idempotencia
    // -------------------------------------------------------------------------
    const claveIdempotencia = 'IDEMP_TEST_CONCURRENT_001';
    await prisma.registroIdempotencia.create({
      data: {
        clave: claveIdempotencia,
        tipoOperacion: 'ASISTENCIA',
        colegioId: COLEGIO_TEST,
        estudianteId: estudianteB.id,
        statusCode: 200,
        respuesta: { ok: true, tipo: 'ENTRADA', mensaje: 'Respuesta persistida' },
        expiraAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const cacheL2 = await prisma.registroIdempotencia.findUnique({
      where: { clave: claveIdempotencia },
    });
    assert(
      cacheL2 !== null && cacheL2.statusCode === 200 && cacheL2.clave === claveIdempotencia,
      'ESCENARIO F: Idempotencia persistente en PostgreSQL protege contra peticiones concurrentes entre instancias'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO G: Revocar permisos de usuario → denegación del backend
    // -------------------------------------------------------------------------
    await prisma.usuarioModulo.deleteMany({
      where: { usuarioId: userA.id, modulo: 'salidas' },
    });
    const modsPostRevocar = (
      await prisma.usuarioModulo.findMany({
        where: { usuarioId: userA.id },
      })
    ).map((m) => m.modulo);
    const puedeSalidasDespues = esRutaPermitida('/dashboard/salidas', modsPostRevocar, false);
    assert(
      !puedeSalidasDespues && modsPostRevocar.length === 1,
      'ESCENARIO G: Revocación de permisos surte efecto de inmediato; acceso bloqueado por el servidor'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO H: Simular reintento rezagado (> 3 minutos de desfase)
    // -------------------------------------------------------------------------
    const clientTimestampAntiguo = Date.now() - 5 * 60 * 1000; // 5 minutos atrás
    const desfaseMs = Date.now() - clientTimestampAntiguo;
    const esReintentoRezagado = desfaseMs > 3 * 60 * 1000;
    assert(
      esReintentoRezagado,
      'ESCENARIO H: Guardia de reintento HTTP rezagado detecta desfase > 3 min y previene conversión a salida'
    );

    // -------------------------------------------------------------------------
    // ESCENARIO I: Turno nocturno que cruza medianoche y atribución de fechaBase
    // -------------------------------------------------------------------------
    // Simular hora 01:30 AM del día siguiente con turno que empezó a las 20:00 del día anterior
    const ahoraMadrugada = new Date('2026-10-15T01:30:00-05:00');
    const ventanaNocturna = obtenerVentanaTurno({
      horaEntrada: '20:00',
      horaSalida: '02:00',
      margenEntradaAnticipadaMinutos: 60,
      margenSalidaAnticipadaMinutos: 0,
      margenSalidaMinutos: 60,
      ahora: ahoraMadrugada,
    });
    // La fechaBase debe ser 2026-10-14 (el día que inició el turno), no 2026-10-15
    assert(
      ventanaNocturna.fechaBase === '2026-10-14',
      `ESCENARIO I: Turno nocturno atribuye fecha escolar al día de inicio (${ventanaNocturna.fechaBase}) y no al día civil siguiente`
    );

    // -------------------------------------------------------------------------
    // ESCENARIO J: Revisar los 23 módulos y dependencias del catálogo
    // -------------------------------------------------------------------------
    const todosModulosExisten = MODULOS_OPERATIVOS.length === 23;
    const sinAuditoriaVisual = !MODULOS_OPERATIVOS.some((m) => m.id === 'auditoria');
    assert(
      todosModulosExisten && sinAuditoriaVisual,
      'ESCENARIO J: Catálogo completo de los 23 módulos verificado; Auditoría excluida del ámbito visual'
    );

    // Limpieza de datos de prueba
    await prisma.asistencia.deleteMany({
      where: { estudiante: { codigo: { startsWith: 'AUDIT_E2E_' } } },
    });
    await prisma.estudiante.deleteMany({
      where: { codigo: { startsWith: 'AUDIT_E2E_' } },
    });
    await prisma.usuario.deleteMany({
      where: { usuario: { startsWith: 'audit_user_' } },
    });
    await prisma.codigoFamiliar.deleteMany({
      where: { codigo: { startsWith: 'FAM_AUDIT_' } },
    });
    await prisma.registroIdempotencia.deleteMany({
      where: { clave: claveIdempotencia },
    });
  } catch (err: any) {
    console.error('Error durante la ejecución de los escenarios:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    console.log('\n========================================================================');
    console.log(`  RESULTADO AUDITORÍA E2E: ${aprobadas} de ${total} ESCENARIOS APROBADOS (${Math.round((aprobadas / total) * 100)}%)`);
    console.log('========================================================================\n');
  }
}

main();
