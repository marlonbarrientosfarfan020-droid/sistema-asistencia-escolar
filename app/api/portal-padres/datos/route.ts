import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionPadre } from "@/lib/auth-padres";
import {
  verificarModuloActivo,
  registrarAuditoriaBloqueo,
} from "@/lib/supermotor-guard";
import {
  fechaPeru,
  ahoraPeru,
  crearFechaHoraPeru,
} from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirSesionPadre(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  // FASE 4.4: Validar portalActivo en SuperMotor
  const validacionPortal = await verificarModuloActivo("portal");
  if (!validacionPortal.autorizado) {
    await registrarAuditoriaBloqueo({
      modulo: "PORTAL",
      motivo: validacionPortal.motivo || "MODULO_DESACTIVADO",
      usuario: `Padre ID ${acceso.sesion.codigoFamiliarId}`,
    });

    return NextResponse.json(
      {
        ok: false,
        estado: "bloqueado",
        message: "Portal temporalmente suspendido por administración.",
        mensaje: "Portal temporalmente suspendido por administración.",
      },
      { status: 403 }
    );
  }

  const { codigoFamiliarId } = acceso.sesion;

  try {
    const { searchParams } = new URL(request.url);
    const estudianteIdParam = searchParams.get("estudianteId");

    // 1. Obtener familia y configuración
    const [familia, config] = await Promise.all([
      prisma.codigoFamiliar.findUnique({
        where: { id: codigoFamiliarId },
        include: {
          estudiantes: {
            where: { estado: true },
            include: {
              turno: {
                select: {
                  id: true,
                  nombre: true,
                  horaEntrada: true,
                  horaSalida: true,
                  estado: true,
                  minutosAlertaInicial: true,
                  margenAlertaMinutos: true,
                },
              },
            },
            orderBy: [{ grado: "asc" }, { seccion: "asc" }, { apellidos: "asc" }],
          },
        },
      }),
      prisma.configuracion.findFirst({
        select: {
          nombreColegio: true,
          logoUrl: true,
          telefono: true,
          correo: true,
          canalPortalWebActivo: true,
        },
      }),
    ]);

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado en el sistema" },
        { status: 404 }
      );
    }

    if (!familia.estado) {
      return NextResponse.json(
        { ok: false, message: "El acceso para este código familiar está suspendido" },
        { status: 403 }
      );
    }

    if (familia.estudiantes.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No hay estudiantes vinculadas a este código familiar" },
        { status: 404 }
      );
    }

    const colegioId = (familia as any).colegioId || "SANTA_RITA_001";

    // 2. Determinar estudiante activa
    let estudianteActiva = familia.estudiantes[0];
    if (estudianteIdParam) {
      const encontrada = familia.estudiantes.find(
        (e) => e.id === Number(estudianteIdParam)
      );
      if (encontrada) {
        estudianteActiva = encontrada;
      }
    }

    // 3. Obtener asistencias de la estudiante activa (últimos 60 registros) con aislamiento multi colegio
    const asistencias = await prisma.asistencia.findMany({
      where: {
        estudianteId: estudianteActiva.id,
        colegioId,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 60,
      select: {
        id: true,
        fecha: true,
        fechaDia: true,
        horaEntrada: true,
        horaSalida: true,
        metodo: true,
        estado: true,
        estadoJornada: true,
        estadoSalida: true,
        fotoEntrada: true,
        fotoSalida: true,
        fotoUrl: true,
        salidaExcepcional: {
          select: {
            motivo: true,
            motivoDetalle: true,
            observacion: true,
            usuarioRegistro: true,
          },
        },
      },
    });

    // 4. Evaluar si la jornada de hoy amerita ausencia virtual confirmada
    const hoyStr = fechaPeru();
    const ahora = ahoraPeru();
    const fechaHoyBD = new Date(`${hoyStr}T00:00:00.000Z`);

    const eventoNoLectivo = await prisma.calendarioEscolar.findFirst({
      where: {
        colegioId,
        estado: true,
        fechaInicio: { lte: fechaHoyBD },
        fechaFin: { gte: fechaHoyBD },
        OR: [
          { todosLosTurnos: true },
          { turnoId: (estudianteActiva as any).turnoId || undefined },
        ],
      },
    }).catch(() => null);

    const esDiaNoLectivo = Boolean(eventoNoLectivo);

    // Comprobar si ya existe marcación registrada hoy
    const tieneAsistenciaHoy = asistencias.some((a) => {
      if (a.fechaDia === hoyStr) return true;
      return fechaPeru(new Date(a.fecha)) === hoyStr;
    });

    const turno = estudianteActiva.turno;
    const esTurnoActivo = Boolean(turno && turno.estado === true);
    let horaSalidaSuperada = false;

    if (turno?.horaSalida) {
      const horaSalidaTurno = crearFechaHoraPeru(hoyStr, turno.horaSalida);
      horaSalidaSuperada = ahora >= horaSalidaTurno;
    }

    // Condiciones estrictas de Ausencia Virtual Confirmada:
    // 1. No tiene marcación de ingreso hoy
    // 2. Pertenece a un turno activo
    // 3. No es día no lectivo / feriado
    // 4. La hora actual ya superó la hora de salida de su turno
    const esAusenciaVirtualHoy =
      !tieneAsistenciaHoy &&
      esTurnoActivo &&
      !esDiaNoLectivo &&
      horaSalidaSuperada;

    // 5. Calcular métricas de la estudiante (faltas = históricas + ausencia virtual de hoy)
    const faltasHistoricas = asistencias.filter(
      (a) => a.estado === "AUSENTE" || a.estado === "FALTA"
    ).length;
    const faltas = faltasHistoricas + (esAusenciaVirtualHoy ? 1 : 0);

    const puntuales = asistencias.filter((a) => a.estado === "PUNTUAL").length;
    const tardanzas = asistencias.filter(
      (a) => a.estado === "TARDANZA" || a.estado === "TARDE"
    ).length;
    const justificados = asistencias.filter((a) => a.estado === "JUSTIFICADO").length;

    const totalRegistros = asistencias.length + (esAusenciaVirtualHoy ? 1 : 0);

    const porcentajePuntualidad =
      totalRegistros > 0 ? Math.round((puntuales / totalRegistros) * 100) : 0;

    const distribucionDona = [
      { name: "Puntual", valor: puntuales, color: "#10B981" },
      { name: "Tardanza", valor: tardanzas, color: "#F59E0B" },
    ];

    if (justificados > 0) {
      distribucionDona.push({ name: "Justificado", valor: justificados, color: "#6366F1" });
    }

    if (faltas > 0) {
      distribucionDona.push({ name: "Faltas / Ausencias", valor: faltas, color: "#EF4444" });
    }

    // Proyección virtual de la ausencia en la lista de asistencias (sin tocar BD)
    const listaAsistencias = esAusenciaVirtualHoy
      ? [
          {
            id: -1,
            fecha: ahora.toISOString(),
            fechaDia: hoyStr,
            horaEntrada: null,
            horaSalida: null,
            metodo: "SISTEMA",
            estado: "AUSENTE",
            estadoJornada: "CERRADA",
            estadoSalida: null,
            fotoEntrada: null,
            fotoSalida: null,
            fotoUrl: null,
          },
          ...asistencias,
        ]
      : asistencias;

    // Agrupación de asistencias por mes para gráfica de barras
    const mapaMeses = new Map<string, { mes: string; puntuales: number; tardanzas: number }>();
    const nombresMeses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Set", "Oct", "Nov", "Dic"
    ];

    // Orden cronológico ascendente para el gráfico
    const asistenciasAsc = [...asistencias].reverse();
    for (const a of asistenciasAsc) {
      const d = new Date(a.fecha);
      const claveMes = `${d.getFullYear()}-${d.getMonth()}`;
      const etiqueta = `${nombresMeses[d.getMonth()]} ${d.getFullYear()}`;

      if (!mapaMeses.has(claveMes)) {
        mapaMeses.set(claveMes, { mes: etiqueta, puntuales: 0, tardanzas: 0 });
      }

      const item = mapaMeses.get(claveMes)!;
      if (a.estado === "PUNTUAL") item.puntuales++;
      if (a.estado === "TARDANZA" || a.estado === "TARDE") item.tardanzas++;
    }

    const barrasMeses = Array.from(mapaMeses.values());

    return NextResponse.json({
      ok: true,
      familia: {
        id: familia.id,
        codigo: familia.codigo,
        tutorTitular: familia.tutorTitular,
        telefonoContacto: familia.telefonoContacto,
        ultimoIngresoAt: familia.ultimoIngresoAt,
      },
      estudiantes: familia.estudiantes.map((e) => ({
        id: e.id,
        codigo: e.codigo,
        dni: e.dni,
        nombres: e.nombres,
        apellidos: e.apellidos,
        grado: e.grado,
        seccion: e.seccion,
        turno: e.turno,
      })),
      estudianteActiva: {
        id: estudianteActiva.id,
        codigo: estudianteActiva.codigo,
        dni: estudianteActiva.dni,
        nombres: estudianteActiva.nombres,
        apellidos: estudianteActiva.apellidos,
        grado: estudianteActiva.grado,
        seccion: estudianteActiva.seccion,
        turno: estudianteActiva.turno,
        estadoHoy: esAusenciaVirtualHoy ? "AUSENTE" : (tieneAsistenciaHoy ? "PRESENTE" : "PENDIENTE"),
      },
      metricasEstudiante: {
        totalRegistros,
        puntuales,
        tardanzas,
        justificados,
        faltas,
        porcentajePuntualidad,
        estadoHoy: esAusenciaVirtualHoy ? "AUSENTE" : (tieneAsistenciaHoy ? "PRESENTE" : "PENDIENTE"),
      },
      distribucionDona,
      barrasMeses,
      asistencias: listaAsistencias,
      infoColegio: {
        nombreColegio: config?.nombreColegio || "I.E.P. Santa Rita de Cassia",
        logoUrl: config?.logoUrl || "/img/logo-santa-rita.png",
        telefono: config?.telefono || "(01) 581-2244",
        correo: config?.correo || "contacto@santaritadecassia.edu.pe",
      },
    });
  } catch (error) {
    console.error("Error obteniendo datos del portal de padres:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al obtener datos de asistencia" },
      { status: 500 }
    );
  }
}
