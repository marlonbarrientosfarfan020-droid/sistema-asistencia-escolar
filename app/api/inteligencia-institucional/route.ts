import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDirectivoODemo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONA_HORARIA = "America/Lima";

function fechaPeru(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function sumarDias(fechaISO: string, dias: number) {
  const fecha = new Date(`${fechaISO}T12:00:00-05:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fechaPeru(fecha);
}

function siguienteProgramacion({
  frecuencia,
  diaSemana,
  diaMes,
  hora,
}: {
  frecuencia: string;
  diaSemana: number;
  diaMes: number;
  hora: string;
}) {
  const ahora = new Date();
  const [h, m] = String(hora || "18:00").split(":").map(Number);

  if (frecuencia === "MENSUAL") {
    let anio = ahora.getFullYear();
    let mes = ahora.getMonth();
    let candidato = new Date(anio, mes, Math.min(Math.max(diaMes || 1, 1), 28), h || 0, m || 0);

    if (candidato <= ahora) {
      mes += 1;
      candidato = new Date(anio, mes, Math.min(Math.max(diaMes || 1, 1), 28), h || 0, m || 0);
    }

    return candidato;
  }

  const objetivo = Math.min(Math.max(diaSemana || 1, 1), 7);
  const diaActual = ahora.getDay() === 0 ? 7 : ahora.getDay();
  let diferencia = objetivo - diaActual;
  const candidatoHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h || 0, m || 0);

  if (diferencia < 0 || (diferencia === 0 && candidatoHoy <= ahora)) {
    diferencia += 7;
  }

  const resultado = new Date(ahora);
  resultado.setDate(ahora.getDate() + diferencia);
  resultado.setHours(h || 0, m || 0, 0, 0);
  return resultado;
}

export async function GET() {
  const acceso = await exigirAdminDirectivoODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const hoy = fechaPeru(new Date());
    const desde30 = sumarDias(hoy, -29);
    const inicio30 = new Date(`${desde30}T00:00:00-05:00`);
    const finHoy = new Date(`${hoy}T23:59:59.999-05:00`);

    const [
      configuracion,
      totalEstudiantes,
      estudiantesConTelegram,
      riesgos,
      asistencias30,
      historialReportes,
      ultimoAnalisis,
      topRiesgo,
    ] = await Promise.all([
      prisma.configuracion.findFirst({ orderBy: { id: "asc" } }),
      prisma.estudiante.count({ where: { estado: true } }),
      prisma.estudiante.count({
        where: {
          estado: true,
          telegramChatId: { not: "" },
        },
      }),
      prisma.riesgoEstudianteIA.findMany({
        include: {
          estudiante: {
            include: { turno: true },
          },
        },
        orderBy: [{ porcentaje: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.asistencia.findMany({
        where: {
          fecha: {
            gte: inicio30,
            lte: finHoy,
          },
        },
        select: {
          fecha: true,
          estado: true,
          estudianteId: true,
        },
      }),
      prisma.historialReporteAutomatico.findMany({
        take: 3000,
        orderBy: { createdAt: "desc" },
        include: {
          estudiante: {
            select: {
              nombres: true,
              apellidos: true,
              grado: true,
              seccion: true,
            },
          },
        },
      }),
      prisma.analisisIA.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.riesgoEstudianteIA.findMany({
        take: 10,
        orderBy: [{ porcentaje: "desc" }, { updatedAt: "desc" }],
        include: {
          estudiante: {
            include: { turno: true },
          },
        },
      }),
    ]);

    const riesgoAlto = riesgos.filter((r) => r.nivel === "ALTO").length;
    const riesgoMedio = riesgos.filter((r) => r.nivel === "MEDIO").length;
    const riesgoBajo = riesgos.filter((r) => r.nivel === "BAJO").length;
    const riesgoTotal = riesgos.length;
    const riesgoPromedio = riesgoTotal
      ? Math.round(riesgos.reduce((s, r) => s + Number(r.porcentaje || 0), 0) / riesgoTotal)
      : 0;

    const coberturaTelegram = totalEstudiantes
      ? Math.round((estudiantesConTelegram / totalEstudiantes) * 100)
      : 0;

    const enviados = historialReportes.filter((r) => r.estado === "ENVIADO").length;
    const errores = historialReportes.filter((r) => r.estado === "ERROR").length;
    const omitidos = historialReportes.filter((r) =>
      ["OMITIDO", "SIN_TELEGRAM"].includes(r.estado)
    ).length;
    const tasaExito = enviados + errores > 0
      ? Math.round((enviados / (enviados + errores)) * 100)
      : 0;

    const tendencia30 = Array.from({ length: 30 }, (_, indice) => {
      const fecha = sumarDias(desde30, indice);
      const registros = asistencias30.filter((a) => fechaPeru(a.fecha) === fecha);
      const presentes = new Set(registros.map((a) => a.estudianteId)).size;
      const tardanzas = registros.filter((a) => a.estado === "TARDE").length;

      return {
        fecha,
        presentes,
        tardanzas,
        ausentes: Math.max(totalEstudiantes - presentes, 0),
        porcentaje: totalEstudiantes
          ? Math.round((presentes / totalEstudiantes) * 100)
          : 0,
      };
    });

    const riesgoPorTurnoMap = new Map<string, any>();
    const riesgoPorSeccionMap = new Map<string, any>();

    for (const riesgo of riesgos) {
      const turno = riesgo.estudiante.turno?.nombre || "SIN TURNO";
      const actualTurno = riesgoPorTurnoMap.get(turno) || {
        turno,
        alto: 0,
        medio: 0,
        bajo: 0,
        suma: 0,
        cantidad: 0,
      };
      actualTurno.cantidad++;
      actualTurno.suma += Number(riesgo.porcentaje || 0);
      if (riesgo.nivel === "ALTO") actualTurno.alto++;
      if (riesgo.nivel === "MEDIO") actualTurno.medio++;
      if (riesgo.nivel === "BAJO") actualTurno.bajo++;
      riesgoPorTurnoMap.set(turno, actualTurno);

      const clave = `${turno}__${riesgo.estudiante.grado}__${riesgo.estudiante.seccion}`;
      const actualSeccion = riesgoPorSeccionMap.get(clave) || {
        etiqueta: `${turno} · ${riesgo.estudiante.grado}° ${riesgo.estudiante.seccion}`,
        turno,
        grado: riesgo.estudiante.grado,
        seccion: riesgo.estudiante.seccion,
        alto: 0,
        medio: 0,
        bajo: 0,
        suma: 0,
        cantidad: 0,
      };
      actualSeccion.cantidad++;
      actualSeccion.suma += Number(riesgo.porcentaje || 0);
      if (riesgo.nivel === "ALTO") actualSeccion.alto++;
      if (riesgo.nivel === "MEDIO") actualSeccion.medio++;
      if (riesgo.nivel === "BAJO") actualSeccion.bajo++;
      riesgoPorSeccionMap.set(clave, actualSeccion);
    }

    const riesgoPorTurno = Array.from(riesgoPorTurnoMap.values()).map((item) => ({
      ...item,
      promedio: item.cantidad ? Math.round(item.suma / item.cantidad) : 0,
    }));

    const seccionesCriticas = Array.from(riesgoPorSeccionMap.values())
      .map((item) => ({
        ...item,
        promedio: item.cantidad ? Math.round(item.suma / item.cantidad) : 0,
        puntaje: item.alto * 3 + item.medio * 2,
      }))
      .sort((a, b) => b.puntaje - a.puntaje || b.promedio - a.promedio)
      .slice(0, 10);

    const reportesPorDiaMap = new Map<string, any>();
    for (let i = 13; i >= 0; i--) {
      const fecha = sumarDias(hoy, -i);
      reportesPorDiaMap.set(fecha, { fecha, enviados: 0, errores: 0, omitidos: 0 });
    }

    for (const reporte of historialReportes) {
      const dia = reportesPorDiaMap.get(fechaPeru(reporte.createdAt));
      if (!dia) continue;
      if (reporte.estado === "ENVIADO") dia.enviados++;
      else if (reporte.estado === "ERROR") dia.errores++;
      else dia.omitidos++;
    }

    const erroresPorCausaMap = new Map<string, number>();
    for (const reporte of historialReportes) {
      if (!["ERROR", "OMITIDO", "SIN_TELEGRAM"].includes(reporte.estado)) continue;
      const causa = reporte.estado === "SIN_TELEGRAM"
        ? "Sin Telegram"
        : reporte.estado === "OMITIDO"
        ? "Omitido"
        : "Error de envío";
      erroresPorCausaMap.set(causa, (erroresPorCausaMap.get(causa) || 0) + 1);
    }

    const proximoDirector = configuracion
      ? siguienteProgramacion({
          frecuencia: configuracion.frecuenciaReporteDirector,
          diaSemana: configuracion.diaReporteDirector,
          diaMes: configuracion.diaMesReporteDirector,
          hora: configuracion.horaReporteDirector,
        })
      : null;

    const proximoPadres = configuracion
      ? siguienteProgramacion({
          frecuencia: configuracion.frecuenciaReportePadres,
          diaSemana: configuracion.diaReportePadres,
          diaMes: configuracion.diaMesReportePadres,
          hora: configuracion.horaReportePadres,
        })
      : null;

    return NextResponse.json({
      ok: true,
      actualizadoEn: new Date(),
      institucion: {
        nombre: configuracion?.nombreColegio || "Institución educativa",
      },
      resumen: {
        totalEstudiantes,
        estudiantesAnalizados: riesgoTotal,
        riesgoAlto,
        riesgoMedio,
        riesgoBajo,
        riesgoPromedio,
        coberturaTelegram,
        historialEnviados: enviados,
        historialErrores: errores,
        historialOmitidos: omitidos,
        tasaExito,
      },
      configuracionReportes: {
        director: {
          activo: configuracion?.reporteDirectorActivo || false,
          frecuencia: configuracion?.frecuenciaReporteDirector || "SEMANAL",
          hora: configuracion?.horaReporteDirector || "18:00",
          proximoEnvio: proximoDirector,
          ultimoEnvio:
            configuracion?.ultimoReporteDirectorAt ||
            configuracion?.ultimoReporteTelegramAt ||
            null,
          ultimoEstado: configuracion?.ultimoReporteTelegramEstado || "",
          excel: configuracion?.enviarReporteExcel ?? true,
          pdf: configuracion?.enviarReportePdf ?? true,
          chatConfigurado: Boolean(configuracion?.telegramDirectorChatId),
        },
        padres: {
          activo: configuracion?.reportePadresActivo || false,
          frecuencia: configuracion?.frecuenciaReportePadres || "SEMANAL",
          hora: configuracion?.horaReportePadres || "19:00",
          proximoEnvio: proximoPadres,
          ultimoEnvio: configuracion?.ultimoReportePadresAt || null,
          incluirRiesgo: configuracion?.incluirRiesgoIAReportePadres ?? true,
        },
      },
      analitica: {
        riesgoDistribucion: [
          { nombre: "Alto", valor: riesgoAlto },
          { nombre: "Medio", valor: riesgoMedio },
          { nombre: "Bajo", valor: riesgoBajo },
        ],
        riesgoPorTurno,
        seccionesCriticas,
        tendencia30,
        reportesPorDia: Array.from(reportesPorDiaMap.values()),
        erroresPorCausa: Array.from(erroresPorCausaMap.entries()).map(([causa, cantidad]) => ({ causa, cantidad })),
      },
      topRiesgo: topRiesgo.map((item) => ({
        id: item.id,
        nivel: item.nivel,
        porcentaje: item.porcentaje,
        resumen: item.resumen,
        recomendacion: item.recomendacion,
        actualizadoEn: item.updatedAt,
        estudiante: {
          id: item.estudiante.id,
          nombres: item.estudiante.nombres,
          apellidos: item.estudiante.apellidos,
          grado: item.estudiante.grado,
          seccion: item.estudiante.seccion,
          turno: item.estudiante.turno?.nombre || null,
        },
      })),
      historial: historialReportes.slice(0, 25).map((item) => ({
        id: item.id,
        tipo: item.tipo,
        destinatario: item.destinatario,
        estado: item.estado,
        detalle: item.detalle,
        createdAt: item.createdAt,
        estudiante: item.estudiante,
      })),
      resumenIA:
        ultimoAnalisis?.resultado ||
        "Todavía no existe un análisis general generado por IA.",
    });
  } catch (error) {
    console.error("Error cargando inteligencia institucional:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo cargar la inteligencia institucional",
      },
      { status: 500 }
    );
  }
}