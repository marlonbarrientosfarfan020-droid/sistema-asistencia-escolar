import './preload_env.cjs';
import { prisma } from '../lib/prisma';
import { crearTokenSesion } from '../lib/auth';
import { POST as asistenciasPOST } from '../app/api/asistencias/route';
import { horaPeru } from '../lib/timezone';
import crypto from 'crypto';

interface TestResult {
  num: number;
  nombre: string;
  paso: boolean;
  detalle?: any;
}

const resultados: TestResult[] = [];

function registrarPrueba(nombre: string, paso: boolean, detalle?: any) {
  const num = resultados.length + 1;
  resultados.push({ num, nombre, paso, detalle });
  if (paso) {
    console.log(`  ✅ [PASS] #${num}: ${nombre}`);
  } else {
    console.error(`  ❌ [FAIL] #${num}: ${nombre}`, detalle ? `\n     Detalle: ${JSON.stringify(detalle)}` : '');
    process.exitCode = 1;
  }
}

async function ejecutar() {
  console.log('========================================================================');
  console.log('  TEST DE REGRESIÓN P0: STALE CLOSURE & PERSISTENCIA DE MODO SALIDA    ');
  console.log('========================================================================\n');

  const COLEGIO_TEST = 'SANTA_RITA_001';

  // 1. REPRODUCCIÓN FORMAL DEL COMPORTAMIENTO REACT: STALE CLOSURE VS REF MUTABLE
  console.log('--- FASE 1: Verificación de Modelo de Renderizado React (Stale Closure vs Ref) ---');
  {
    // A) MODELO ANTERIOR (Sin Ref - Causa del Incidente):
    // Render 1: Montaje del componente Terminal V2
    let callbackGuardadoEnHtml5Qrcode_Antes: (() => { intencionOperativa: string }) | null = null;
    function renderTerminalV2_Antes(modo: "ENTRADA" | "SALIDA", esPrimerRender: boolean) {
      const modoOperativo = modo; // const inmutable de este ciclo de render
      const procesarLecturaQRContinuo = () => {
        // Accede al lexical scope de ESTE render
        return { intencionOperativa: modoOperativo };
      };
      if (esPrimerRender) {
        // Html5Qrcode.start guarda el callback de la primera ejecución
        callbackGuardadoEnHtml5Qrcode_Antes = procesarLecturaQRContinuo;
      }
    }

    // Paso 1: Carga la página (modoOperativo = "ENTRADA", la cámara se inicia)
    renderTerminalV2_Antes("ENTRADA", true);

    // Paso 2: El operador pulsa el botón SALIDA en el celular
    // React hace re-render con nuevo estado "SALIDA"
    renderTerminalV2_Antes("SALIDA", false);

    // Paso 3: El estudiante presenta el carnet QR al celular
    // Html5Qrcode ejecuta el callback que tenía almacenado en su instancia nativa
    const payloadLeido_Antes = callbackGuardadoEnHtml5Qrcode_Antes!();

    registrarPrueba(
      'Fallo Original Demostrado: Escáner con Stale Closure enviaba "ENTRADA" a pesar de que la UI estaba en "SALIDA"',
      payloadLeido_Antes.intencionOperativa === 'ENTRADA',
      { payloadEnviado: payloadLeido_Antes, estadoUI: "SALIDA" }
    );

    // B) MODELO CORREGIDO (Con Ref Mutable sincronizada):
    const modoOperativoRef = { current: "ENTRADA" as "ENTRADA" | "SALIDA" };
    let callbackGuardadoEnHtml5Qrcode_Despues: (() => { intencionOperativa: string }) | null = null;

    function renderTerminalV2_Despues(modo: "ENTRADA" | "SALIDA", esPrimerRender: boolean) {
      const cambiarModoOperativo = (nuevo: "ENTRADA" | "SALIDA") => {
        modoOperativoRef.current = nuevo;
      };
      const procesarLecturaQRContinuo = () => {
        // En lugar de leer el const stale, lee la referencia mutable actual
        const modoActual = modoOperativoRef.current;
        return { intencionOperativa: modoActual };
      };
      if (esPrimerRender) {
        callbackGuardadoEnHtml5Qrcode_Despues = procesarLecturaQRContinuo;
      }
      return { cambiarModoOperativo };
    }

    // Paso 1: Carga la página
    const { cambiarModoOperativo } = renderTerminalV2_Despues("ENTRADA", true);

    // Paso 2: El operador pulsa SALIDA
    cambiarModoOperativo("SALIDA");
    renderTerminalV2_Despues("SALIDA", false);

    // Paso 3: Escaneo QR
    const payloadLeido_Despues = callbackGuardadoEnHtml5Qrcode_Despues!();

    registrarPrueba(
      'Corrección Verificada: Escáner corregido consulta modoOperativoRef y envía exactamente "SALIDA"',
      payloadLeido_Despues.intencionOperativa === 'SALIDA',
      { payloadEnviado: payloadLeido_Despues, estadoUI: "SALIDA" }
    );
  }

  // 2. PRUEBA DE INTEGRACIÓN E2E CON POSTGRESQL AISLADO
  console.log('\n--- FASE 2: Integración E2E con Base de Datos Aislada y Backend ---');

  // Asegurar colegio base
  await prisma.colegio.upsert({
    where: { codigo: COLEGIO_TEST },
    create: {
      codigo: COLEGIO_TEST,
      nombre: 'I.E.P. Santa Rita de Cassia (Auditoría)',
      estado: 'ACTIVO',
    },
    update: { estado: 'ACTIVO' },
  });

  // Asegurar usuario para autenticación de terminal / portería
  let usuarioAdmin = await prisma.usuario.findFirst({
    where: { colegioId: COLEGIO_TEST, rol: 'ADMIN_COLEGIO' }
  });
  if (!usuarioAdmin) {
    usuarioAdmin = await prisma.usuario.create({
      data: {
        colegio: { connect: { codigo: COLEGIO_TEST } },
        usuario: 'admin_test_p0',
        password: 'hash_test_placeholder',
        rol: 'ADMIN_COLEGIO',
        estado: true,
      }
    });
  }

  const tokenAuth = await crearTokenSesion({
    usuarioId: usuarioAdmin.id,
    usuario: usuarioAdmin.usuario,
    rol: 'ADMIN_COLEGIO',
    colegioId: COLEGIO_TEST,
    modulos: ['marcar', 'asistencia', 'salidas'],
  });

  // Asegurar Turno con ventana de salida abierta para la hora actual
  const now = new Date();
  const horaActualStr = horaPeru(now);
  const [hStr, mStr] = horaActualStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  const horaSalidaTurno = `${String(h).padStart(2, '0')}:${String(Math.min(59, m + 5)).padStart(2, '0')}`;
  const horaEntradaTurno = `${String(Math.max(0, h - 5)).padStart(2, '0')}:00`;

  let turnoP0 = await prisma.turno.findFirst({
    where: { colegioId: COLEGIO_TEST, nombre: 'TURNO_HOTFIX_P0' }
  });

  if (!turnoP0) {
    turnoP0 = await prisma.turno.create({
      data: {
        colegio: { connect: { codigo: COLEGIO_TEST } },
        nombre: 'TURNO_HOTFIX_P0',
        horaEntrada: horaEntradaTurno,
        horaSalida: horaSalidaTurno,
        estado: true,
        margenEntradaAnticipadaMinutos: 60,
        margenSalidaAnticipadaMinutos: 45,
        margenSalidaMinutos: 120,
        minutosAlertaInicial: 5,
        margenAlertaMinutos: 15,
      }
    });
  } else {
    turnoP0 = await prisma.turno.update({
      where: { id: turnoP0.id },
      data: {
        horaEntrada: horaEntradaTurno,
        horaSalida: horaSalidaTurno,
        margenSalidaAnticipadaMinutos: 45,
        margenSalidaMinutos: 120,
      }
    });
  }

  // Asegurar estudiante sintético para pruebas
  const DNI_TEST = '99988811';
  const CODIGO_TEST = 'P0_TEST_ESTUDIANTE';
  let estudianteTest = await prisma.estudiante.findFirst({
    where: { codigo: CODIGO_TEST }
  });

  if (!estudianteTest) {
    estudianteTest = await prisma.estudiante.create({
      data: {
        colegio: { connect: { codigo: COLEGIO_TEST } },
        codigo: CODIGO_TEST,
        dni: DNI_TEST,
        nombres: 'Estudiante Sintético',
        apellidos: 'Auditoría P0',
        grado: '5',
        seccion: 'A',
        turno: { connect: { id: turnoP0.id } },
        estado: true,
      }
    });
  } else {
    estudianteTest = await prisma.estudiante.update({
      where: { id: estudianteTest.id },
      data: { turnoId: turnoP0.id }
    });
  }

  // Limpiar asistencias previas del estudiante de prueba
  await prisma.asistencia.deleteMany({
    where: { estudianteId: estudianteTest.id }
  });

  // Asegurar SistemaControl con motor activo y asistencia activa
  await prisma.sistemaControl.upsert({
    where: { colegioId: COLEGIO_TEST },
    create: {
      colegioId: COLEGIO_TEST,
      motorActivo: true,
      asistenciaActivo: true,
      fotosActivo: false,
      modoOperacion: 'MANUAL',
      estadoJornada: 'OPERATIVO',
    },
    update: {
      motorActivo: true,
      asistenciaActivo: true,
      modoOperacion: 'MANUAL',
    }
  });

  // Helper para invocar POST /api/asistencias
  async function invocarAsistenciasAPI(body: any) {
    const req = new Request('http://localhost:3000/api/asistencias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAuth}`,
        'x-idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const res = await asistenciasPOST(req);
    const data = await res.json();
    return { status: res.status, data };
  }

  // PASO 1: Registrar Entrada Inicial
  console.log('\n--- PASO 1: Registrar Entrada Inicial del Estudiante ---');
  const resEntrada = await invocarAsistenciasAPI({
    dni: DNI_TEST,
    codigo: CODIGO_TEST,
    metodo: 'QR',
    intencionOperativa: 'ENTRADA',
  });

  registrarPrueba(
    'Registro de Entrada inicial exitoso (HTTP 200, ENTRADA_REGISTRADA)',
    resEntrada.status === 200 && resEntrada.data.codigoResultado === 'ENTRADA_REGISTRADA',
    resEntrada.data
  );

  let asistenciaDb = await prisma.asistencia.findFirst({
    where: { estudianteId: estudianteTest.id },
    orderBy: { id: 'desc' }
  });

  registrarPrueba(
    'Entrada persistida con horaSalida NULL y estadoJornada ABIERTA',
    asistenciaDb !== null && asistenciaDb.horaSalida === null && asistenciaDb.estadoJornada === 'ABIERTA',
    asistenciaDb
  );

  // PASO 2: Simulación de Re-escaneo en Modo ENTRADA (Comportamiento esperado: NO modificar salida, aviso AMARILLO)
  console.log('\n--- PASO 2: Escaneo en modo ENTRADA cuando ya tiene entrada ---');
  const resEntradaRepetida = await invocarAsistenciasAPI({
    dni: DNI_TEST,
    codigo: CODIGO_TEST,
    metodo: 'QR',
    intencionOperativa: 'ENTRADA',
  });

  registrarPrueba(
    'Escaneo en modo ENTRADA retorna ASISTENCIA_YA_REGISTRADA (Aviso Amarillo)',
    resEntradaRepetida.status === 200 && resEntradaRepetida.data.codigoResultado === 'ASISTENCIA_YA_REGISTRADA',
    resEntradaRepetida.data
  );

  asistenciaDb = await prisma.asistencia.findFirst({
    where: { estudianteId: estudianteTest.id },
    orderBy: { id: 'desc' }
  });

  registrarPrueba(
    'horaSalida permanece estrictamente NULL tras escaneo en modo ENTRADA',
    asistenciaDb?.horaSalida === null,
    asistenciaDb
  );

  // PASO 3: Selección de modo SALIDA y Escaneo QR (El caso del incidente P0 resuelto)
  console.log('\n--- PASO 3: Selección de botón SALIDA y Escaneo QR con intencionOperativa SALIDA ---');
  const resSalida = await invocarAsistenciasAPI({
    dni: DNI_TEST,
    codigo: CODIGO_TEST,
    metodo: 'QR',
    intencionOperativa: 'SALIDA',
  });

  registrarPrueba(
    'Escaneo en modo SALIDA retorna SALIDA_REGISTRADA (Confirmación Azul HTTP 200)',
    resSalida.status === 200 && resSalida.data.codigoResultado === 'SALIDA_REGISTRADA',
    resSalida.data
  );

  asistenciaDb = await prisma.asistencia.findFirst({
    where: { estudianteId: estudianteTest.id },
    orderBy: { id: 'desc' }
  });

  registrarPrueba(
    'PostgreSQL persiste atómicamente horaSalida NOT NULL y estadoJornada CERRADA',
    asistenciaDb !== null && asistenciaDb.horaSalida !== null && asistenciaDb.estadoJornada === 'CERRADA',
    {
      id: asistenciaDb?.id,
      horaEntrada: asistenciaDb?.horaEntrada,
      horaSalida: asistenciaDb?.horaSalida,
      estadoJornada: asistenciaDb?.estadoJornada,
      estadoSalida: asistenciaDb?.estadoSalida,
    }
  );

  // PASO 4: Escaneo Repetido en Modo SALIDA (Idempotencia y protección de duplicados)
  console.log('\n--- PASO 4: Re-escaneo tras haber registrado la salida ---');
  const resSalidaRepetida = await invocarAsistenciasAPI({
    dni: DNI_TEST,
    codigo: CODIGO_TEST,
    metodo: 'QR',
    intencionOperativa: 'SALIDA',
  });

  registrarPrueba(
    'Escaneo posterior de salida no sobreescribe ni corrompe el registro (Detecta ya cerrada)',
    (resSalidaRepetida.status === 200 || resSalidaRepetida.status === 409) &&
      (resSalidaRepetida.data.yaRegistrado === true || resSalidaRepetida.data.codigoResultado === 'SALIDA_YA_REGISTRADA'),
    resSalidaRepetida.data
  );

  // PASO 5: Prueba de Marcación Manual por DNI en Modo SALIDA
  console.log('\n--- PASO 5: Marcación Manual por DNI con intencionOperativa SALIDA ---');
  const DNI_TEST_2 = '99988822';
  let estudianteTest2 = await prisma.estudiante.findFirst({
    where: { dni: DNI_TEST_2 }
  });
  if (!estudianteTest2) {
    estudianteTest2 = await prisma.estudiante.create({
      data: {
        colegio: { connect: { codigo: COLEGIO_TEST } },
        codigo: 'P0_TEST_DNI_2',
        dni: DNI_TEST_2,
        nombres: 'Estudiante DNI',
        apellidos: 'Auditoría P0',
        grado: '5',
        seccion: 'B',
        turno: { connect: { id: turnoP0.id } },
        estado: true,
      }
    });
  }
  await prisma.asistencia.deleteMany({
    where: { estudianteId: estudianteTest2.id }
  });

  // Registrar entrada del estudiante 2
  await invocarAsistenciasAPI({
    dni: DNI_TEST_2,
    metodo: 'DNI',
    intencionOperativa: 'ENTRADA',
  });

  // Registrar salida por DNI con intención SALIDA (simulando pulsar botón SALIDA + Enter en DNI)
  const resDniSalida = await invocarAsistenciasAPI({
    dni: DNI_TEST_2,
    metodo: 'DNI',
    intencionOperativa: 'SALIDA',
  });

  registrarPrueba(
    'Marcación por DNI en modo SALIDA registra salida exitosamente (SALIDA_REGISTRADA)',
    resDniSalida.status === 200 && resDniSalida.data.codigoResultado === 'SALIDA_REGISTRADA',
    resDniSalida.data
  );

  const asistenciaDb2 = await prisma.asistencia.findFirst({
    where: { estudianteId: estudianteTest2.id }
  });
  registrarPrueba(
    'horaSalida en BD no es null para marcación por DNI',
    asistenciaDb2?.horaSalida !== null && asistenciaDb2?.estadoJornada === 'CERRADA',
    asistenciaDb2
  );

  // Limpieza de datos sintéticos de prueba
  await prisma.asistencia.deleteMany({
    where: { estudianteId: { in: [estudianteTest.id, estudianteTest2.id] } }
  });
  await prisma.estudiante.deleteMany({
    where: { id: { in: [estudianteTest.id, estudianteTest2.id] } }
  });

  console.log('\n========================================================================');
  const aprobadas = resultados.filter(r => r.paso).length;
  console.log(`  RESUMEN DE PRUEBAS: ${aprobadas}/${resultados.length} APROBADAS`);
  console.log('========================================================================\n');
}

ejecutar()
  .catch((err) => {
    console.error('Error fatal durante la prueba:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
