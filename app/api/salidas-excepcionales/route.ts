import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminOPersonal, exigirAdminDemoOPersonal } from "@/lib/auth";
import { resolverColegio } from "@/lib/tenant";
import { fechaPeru, horaPeru, formatoHora12 } from "@/lib/timezone";
import {
  verificarModuloActivo,
  registrarAuditoriaBloqueo,
  registrarAuditoriaAutorizado,
  respuestaBloqueoSupermotor,
} from "@/lib/supermotor-guard";
import { emitEvent } from "@/lib/events/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const MOTIVOS_SALIDA_EXCEPCIONAL = [
  "PROBLEMA_SALUD",
  "ACCIDENTE_ESCOLAR",
  "CITA_MEDICA",
  "EMERGENCIA_FAMILIAR",
  "RETIRO_AUTORIZADO",
  "OTRO",
] as const;

export type MotivoSalidaExcepcional = (typeof MOTIVOS_SALIDA_EXCEPCIONAL)[number];

export const ETIQUETAS_MOTIVOS: Record<MotivoSalidaExcepcional, string> = {
  PROBLEMA_SALUD: "Problema de salud",
  ACCIDENTE_ESCOLAR: "Accidente escolar",
  CITA_MEDICA: "Cita médica",
  EMERGENCIA_FAMILIAR: "Emergencia familiar",
  RETIRO_AUTORIZADO: "Retiro autorizado por padre/apoderado",
  OTRO: "Otro motivo",
};

/**
 * GET /api/salidas-excepcionales
 * Lista las salidas excepcionales registradas y, opcionalmente,
 * los estudiantes actualmente presentes con jornada abierta listos para salida.
 */
export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }

  const colegioId = tenant.context.colegioId;
  const { searchParams } = new URL(request.url);

  const hoyStr = fechaPeru();
  const fechaParam = searchParams.get("fecha") || hoyStr;
  const soloPresentes = searchParams.get("presentes") === "true";

  try {
    // Si se solicitan las alumnas actualmente en el colegio con jornada abierta
    if (soloPresentes) {
      const asistenciasAbiertas = await prisma.asistencia.findMany({
        where: {
          colegioId,
          fechaDia: fechaParam,
          horaEntrada: { not: null },
          horaSalida: null,
          estadoJornada: "ABIERTA",
        },
        include: {
          estudiante: {
            select: {
              id: true,
              codigo: true,
              dni: true,
              nombres: true,
              apellidos: true,
              grado: true,
              seccion: true,
              nombreTutor: true,
              whatsapp: true,
              turno: {
                select: {
                  id: true,
                  nombre: true,
                  horaEntrada: true,
                  horaSalida: true,
                },
              },
            },
          },
        },
        orderBy: [
          { estudiante: { grado: "asc" } },
          { estudiante: { seccion: "asc" } },
          { estudiante: { apellidos: "asc" } },
        ],
      });

      return NextResponse.json({
        ok: true,
        fecha: fechaParam,
        totalPresentes: asistenciasAbiertas.length,
        estudiantes: asistenciasAbiertas.map((a) => ({
          asistenciaId: a.id,
          estudianteId: a.estudiante.id,
          codigo: a.estudiante.codigo,
          dni: a.estudiante.dni,
          nombreCompleto: `${a.estudiante.nombres} ${a.estudiante.apellidos}`,
          grado: a.estudiante.grado,
          seccion: a.estudiante.seccion,
          nombreTutor: a.estudiante.nombreTutor,
          turno: a.estudiante.turno?.nombre || "Sin turno",
          horaEntrada: a.horaEntrada ? formatoHora12(a.horaEntrada) : null,
          estadoEntrada: a.estado,
        })),
      });
    }

    // Listado general de salidas excepcionales registradas
    const salidas = await prisma.salidaExcepcional.findMany({
      where: {
        colegioId,
        fechaDia: fechaParam,
      },
      include: {
        estudiante: {
          select: {
            id: true,
            codigo: true,
            dni: true,
            nombres: true,
            apellidos: true,
            grado: true,
            seccion: true,
            nombreTutor: true,
            whatsapp: true,
            turno: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        asistencia: {
          select: {
            id: true,
            horaEntrada: true,
            horaSalida: true,
            estado: true,
            estadoJornada: true,
            estadoSalida: true,
          },
        },
      },
      orderBy: {
        horaSalida: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      fecha: fechaParam,
      total: salidas.length,
      salidas: salidas.map((s) => ({
        id: s.id,
        asistenciaId: s.asistenciaId,
        estudianteId: s.estudianteId,
        codigo: s.estudiante.codigo,
        dni: s.estudiante.dni,
        estudiante: `${s.estudiante.nombres} ${s.estudiante.apellidos}`,
        grado: s.estudiante.grado,
        seccion: s.estudiante.seccion,
        tutor: s.estudiante.nombreTutor,
        turno: s.estudiante.turno?.nombre || "Sin turno",
        horaEntrada: s.asistencia.horaEntrada ? formatoHora12(s.asistencia.horaEntrada) : "--:--",
        horaSalida: formatoHora12(s.horaSalida),
        motivo: s.motivo,
        motivoEtiqueta: ETIQUETAS_MOTIVOS[s.motivo as MotivoSalidaExcepcional] || s.motivo,
        motivoDetalle: s.motivoDetalle,
        observacion: s.observacion,
        usuarioRegistro: s.usuarioRegistro,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[SALIDAS EXCEPCIONALES API] Error al obtener listado:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al obtener salidas excepcionales" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/salidas-excepcionales
 * Registra una salida excepcional autorizada para un estudiante con entrada previa.
 */
export async function POST(request: Request) {
  const acceso = await exigirAdminOPersonal(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }

  const colegioId = tenant.context.colegioId;

  // Validación de SuperMotor
  const validacionAsistencia = await verificarModuloActivo("asistencia", colegioId);
  if (!validacionAsistencia.autorizado) {
    await registrarAuditoriaBloqueo({
      modulo: "ASISTENCIA",
      motivo: validacionAsistencia.motivo || "SUPERMOTOR_APAGADO",
      usuario: acceso.sesion.usuario,
      detalles: { colegioId },
    });

    return respuestaBloqueoSupermotor(
      "El sistema de asistencia se encuentra temporalmente desactivado."
    );
  }

  try {
    const body = await request.json();

    const estudianteId = Number(body.estudianteId);
    const motivo = String(body.motivo || "").trim();
    const motivoDetalle = body.motivoDetalle ? String(body.motivoDetalle).trim() : null;
    const observacion = String(body.observacion || "").trim();

    // 1. Validaciones básicas de campos
    if (!estudianteId || isNaN(estudianteId)) {
      return NextResponse.json(
        { ok: false, message: "Debe especificar un estudiante válido." },
        { status: 400 }
      );
    }

    if (!MOTIVOS_SALIDA_EXCEPCIONAL.includes(motivo as MotivoSalidaExcepcional)) {
      return NextResponse.json(
        {
          ok: false,
          message: `El motivo '${motivo}' no es válido. Motivos permitidos: ${MOTIVOS_SALIDA_EXCEPCIONAL.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (motivo === "OTRO" && (!motivoDetalle || motivoDetalle.length < 3)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Si selecciona 'Otro motivo', debe especificar el detalle con al menos 3 caracteres.",
        },
        { status: 400 }
      );
    }

    if (!observacion || observacion.length < 5) {
      return NextResponse.json(
        {
          ok: false,
          message: "La observación manual es obligatoria y debe contener al menos 5 caracteres descriptivos.",
        },
        { status: 400 }
      );
    }

    // 2. Verificar existencia y pertenencia del estudiante
    const estudiante = await prisma.estudiante.findFirst({
      where: {
        id: estudianteId,
        colegioId,
      },
      include: {
        turno: true,
      },
    });

    if (!estudiante) {
      return NextResponse.json(
        { ok: false, message: "Estudiante no encontrado en la institución." },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        { ok: false, message: "El estudiante se encuentra inactivo." },
        { status: 400 }
      );
    }

    const ahora = new Date();
    const fechaDia = fechaPeru(ahora);
    const horaActual12 = formatoHora12(ahora);

    // 3. Buscar asistencia de hoy
    const asistencia = await prisma.asistencia.findFirst({
      where: {
        estudianteId: estudiante.id,
        fechaDia,
        colegioId,
      },
    });

    // REGLA CRÍTICA 1: No se puede registrar salida sin entrada previa
    if (!asistencia || !asistencia.horaEntrada) {
      return NextResponse.json(
        {
          ok: false,
          sinEntrada: true,
          message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} no tiene entrada registrada hoy (${fechaDia}). No es posible registrar una salida sin ingreso previo.`,
        },
        { status: 409 }
      );
    }

    // REGLA CRÍTICA 2: No se puede registrar salida si la jornada ya fue cerrada
    if (asistencia.horaSalida || asistencia.estadoJornada === "CERRADA") {
      const horaSalidaReg = formatoHora12(asistencia.horaSalida || ahora);
      return NextResponse.json(
        {
          ok: false,
          yaCerrada: true,
          message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya tiene una salida registrada hoy a las ${horaSalidaReg}. La jornada escolar ya está CERRADA.`,
        },
        { status: 409 }
      );
    }

    // 4. Ejecución atómica en base de datos
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Actualizar Asistencia: Cierra jornada y asigna estadoSalida = "SALIDA_EXCEPCIONAL"
      // Se mantiene intacto asistencia.estado (PUNTUAL o TARDE), garantizando que el estudiante permanece PRESENTE.
      const asistenciaActualizada = await tx.asistencia.update({
        where: { id: asistencia.id },
        data: {
          horaSalida: ahora,
          estadoJornada: "CERRADA",
          estadoSalida: "SALIDA_EXCEPCIONAL",
        },
      });

      // B. Crear registro en modelo formal SalidaExcepcional
      const salidaExcepcional = await tx.salidaExcepcional.create({
        data: {
          colegioId,
          asistenciaId: asistencia.id,
          estudianteId: estudiante.id,
          fecha: ahora,
          fechaDia,
          horaSalida: ahora,
          motivo,
          motivoDetalle: motivo === "OTRO" ? motivoDetalle : null,
          observacion,
          usuarioRegistro: acceso.sesion.usuario,
        },
      });

      // C. Registrar en Auditoría
      await tx.auditoria.create({
        data: {
          colegioId,
          modulo: "ASISTENCIA",
          accion: "SALIDA_EXCEPCIONAL",
          usuario: acceso.sesion.usuario,
          rol: acceso.sesion.rol,
          detalle: JSON.stringify({
            asistenciaId: asistencia.id,
            estudianteId: estudiante.id,
            estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
            motivo,
            motivoDetalle,
            horaSalida: ahora.toISOString(),
            hora12: horaActual12,
            observacion,
          }),
        },
      });

      return { asistenciaActualizada, salidaExcepcional };
    });

    console.log(
      `[SALIDA EXCEPCIONAL] Registrada para estudiante ${estudiante.id} (${estudiante.nombres} ${estudiante.apellidos}). Motivo: ${motivo}. Usuario: ${acceso.sesion.usuario}`
    );

    // 5. Emitir eventos en tiempo real para Dashboard y Portal de Padres
    emitEvent(
      "ASISTENCIA_SALIDA",
      {
        colegioId,
        asistenciaId: asistencia.id,
        estudianteId: estudiante.id,
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          dni: estudiante.dni,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          tutor: estudiante.nombreTutor,
          turno: estudiante.turno?.nombre,
        },
        hora: horaActual12,
        hora24: horaPeru(ahora),
        fecha: fechaDia,
        metodo: asistencia.metodo,
        estado: asistencia.estado,
        tipo: "SALIDA",
        tipoSalida: "SALIDA_EXCEPCIONAL",
        estadoSalida: "SALIDA_EXCEPCIONAL",
        motivo,
        motivoDetalle: resultado.salidaExcepcional.motivoDetalle || null,
        observacion,
        fotoUrl: asistencia.fotoEntrada || null,
      },
      colegioId
    );

    emitEvent(
      "SALIDA_EXCEPCIONAL_REGISTRADA",
      {
        colegioId,
        id: resultado.salidaExcepcional.id,
        asistenciaId: asistencia.id,
        estudianteId: estudiante.id,
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          dni: estudiante.dni,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          tutor: estudiante.nombreTutor,
          turno: estudiante.turno?.nombre,
        },
        estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
        hora: horaActual12,
        hora24: horaPeru(ahora),
        fecha: fechaDia,
        motivo,
        motivoEtiqueta: ETIQUETAS_MOTIVOS[motivo as MotivoSalidaExcepcional] || motivo,
        motivoDetalle: resultado.salidaExcepcional.motivoDetalle || null,
        observacion,
        usuarioRegistro: acceso.sesion.usuario,
        tipo: "SALIDA",
        tipoSalida: "SALIDA_EXCEPCIONAL",
      },
      colegioId
    );

    return NextResponse.json({
      ok: true,
      tipo: "SALIDA",
      tipoSalida: "SALIDA_EXCEPCIONAL",
      estado: asistencia.estado,
      estadoJornada: "CERRADA",
      estadoSalida: "SALIDA_EXCEPCIONAL",
      message: `Salida excepcional registrada exitosamente para ${estudiante.nombres} ${estudiante.apellidos} a las ${horaActual12}.`,
      salidaExcepcional: resultado.salidaExcepcional,
      asistencia: resultado.asistenciaActualizada,
    });
  } catch (error: any) {
    console.error("[SALIDAS EXCEPCIONALES API] Error al registrar:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al procesar la salida excepcional." },
      { status: 500 }
    );
  }
}
