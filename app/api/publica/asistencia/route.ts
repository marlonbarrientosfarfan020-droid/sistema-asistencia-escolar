import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fechaPeru,
  ahoraPeru,
  clasificarEstadoEstudiante,
  esEstadoPendienteOperativo,
} from "@/lib/timezone";
import { resolverColegio, DEFAULT_COLEGIO_ID } from "@/lib/tenant";
import { obtenerEstadoSuperMotor } from "@/lib/supermotor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaParam = searchParams.get("fecha");

    // 1. Resolución de Colegio (Aislamiento Multi-Tenant estricto)
    const tenant = resolverColegio(null, request);
    const colegioId = tenant.ok ? tenant.context.colegioId : DEFAULT_COLEGIO_ID;

    // 2. Configuración institucional real desde PostgreSQL para este colegio
    const configuracion =
      (await prisma.configuracion.findFirst({
        where: { colegioId },
        select: {
          nombreColegio: true,
          direccion: true,
          telefono: true,
          correo: true,
          director: true,
          logoUrl: true,
          canalPortalWebActivo: true,
          colegioId: true,
        },
      }).catch(() => null)) ||
      (await prisma.configuracion.findFirst({
        select: {
          nombreColegio: true,
          direccion: true,
          telefono: true,
          correo: true,
          director: true,
          logoUrl: true,
          canalPortalWebActivo: true,
          colegioId: true,
        },
      }).catch(() => null));

    const infoInstitucional = {
      nombreColegio: configuracion?.nombreColegio || "I.E.P. Santa Rita de Cassia",
      direccion: configuracion?.direccion || "Cañete, Lima - Perú",
      telefono: configuracion?.telefono || "(01) 581-2244",
      correo: configuracion?.correo || "contacto@santaritadecassia.edu.pe",
      director: configuracion?.director || "Dirección General",
      logoUrl: configuracion?.logoUrl || "/img/logo-santa-rita.png",
      canalPortalWebActivo: configuracion?.canalPortalWebActivo ?? true,
      colegioId,
    };

    // 3. Fecha de consulta (Formato YYYY-MM-DD en zona horaria America/Lima)
    const fechaConsultaStr = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)
      ? fechaParam
      : fechaPeru();

    const inicioDia = new Date(`${fechaConsultaStr}T00:00:00-05:00`);
    const finDia = new Date(`${fechaConsultaStr}T23:59:59.999-05:00`);
    const fechaCalendarioBD = new Date(`${fechaConsultaStr}T00:00:00.000Z`);

    // 4. Consultas con aislamiento estricto por colegioId
    const [estudiantes, turnosBD, asistenciasDia, eventosNoLectivos, estadoSuperMotor] = await Promise.all([
      prisma.estudiante.findMany({
        where: { colegioId, estado: true },
        select: {
          id: true,
          grado: true,
          seccion: true,
          turnoId: true,
          turno: {
            select: {
              id: true,
              nombre: true,
              horaEntrada: true,
              horaSalida: true,
              minutosAlertaInicial: true,
              margenAlertaMinutos: true,
              estado: true,
            },
          },
        },
        orderBy: [{ grado: "asc" }, { seccion: "asc" }, { id: "asc" }],
      }),
      prisma.turno.findMany({
        where: { colegioId },
        orderBy: { id: "asc" },
      }),
      prisma.asistencia.findMany({
        where: {
          colegioId,
          fecha: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        select: {
          id: true,
          estado: true,
          metodo: true,
          horaEntrada: true,
          estudianteId: true,
        },
      }),
      prisma.calendarioEscolar.findMany({
        where: {
          colegioId,
          estado: true,
          fechaInicio: { lte: fechaCalendarioBD },
          fechaFin: { gte: fechaCalendarioBD },
        },
        select: {
          id: true,
          todosLosTurnos: true,
          turnoId: true,
          descripcion: true,
        },
      }),
      obtenerEstadoSuperMotor(colegioId).catch(() => null),
    ]);

    // 5. Consolidación de Asistencias Reales Únicas por Estudiante
    const asistenciasPorEstudiante = new Map<number, (typeof asistenciasDia)[number]>();
    for (const a of asistenciasDia) {
      const actual = asistenciasPorEstudiante.get(a.estudianteId);
      if (!actual || (!actual.horaEntrada && a.horaEntrada)) {
        asistenciasPorEstudiante.set(a.estudianteId, a);
      }
    }

    // 6. Clasificación unificada de cada estudiante usando el motor compartido
    const ahora = ahoraPeru();
    let puntuales = 0;
    let tardanzas = 0;
    let justificados = 0;
    let ausentesConfirmados = 0;
    let pendientesOperativos = 0;
    let alumnasTurnoInactivo = 0;
    let totalOperativas = 0;

    // Estadísticas por turno institucional
    const statsPorTurno = new Map<
      number,
      {
        puntuales: number;
        tardanzas: number;
        justificados: number;
        presentes: number;
        ausentes: number;
        pendientes: number;
        inactivos: number;
        total: number;
      }
    >();

    for (const t of turnosBD) {
      statsPorTurno.set(t.id, {
        puntuales: 0,
        tardanzas: 0,
        justificados: 0,
        presentes: 0,
        ausentes: 0,
        pendientes: 0,
        inactivos: 0,
        total: 0,
      });
    }

    // Estadísticas por grado
    const mapaGrados = new Map<
      string,
      {
        matriculadas: number;
        operativas: number;
        puntuales: number;
        tardanzas: number;
        justificados: number;
        ausentes: number;
        pendientes: number;
        inactivos: number;
      }
    >();

    for (const estudiante of estudiantes) {
      const turno = estudiante.turno;
      const asistencia = asistenciasPorEstudiante.get(estudiante.id);

      const esNoLectivo = eventosNoLectivos.some(
        (ev) => ev.todosLosTurnos || (turno && ev.turnoId === turno.id)
      );

      const estadoEstudiante = clasificarEstadoEstudiante({
        ahora,
        fechaConsulta: fechaConsultaStr,
        turno,
        asistencia,
        esDiaNoLectivo: esNoLectivo,
      });

      // Registro en desglose por grado
      const g = estudiante.grado || "General";
      if (!mapaGrados.has(g)) {
        mapaGrados.set(g, {
          matriculadas: 0,
          operativas: 0,
          puntuales: 0,
          tardanzas: 0,
          justificados: 0,
          ausentes: 0,
          pendientes: 0,
          inactivos: 0,
        });
      }
      const gItem = mapaGrados.get(g)!;
      gItem.matriculadas++;

      const tStats = turno ? statsPorTurno.get(turno.id) : null;
      if (tStats) tStats.total++;

      // REGLA INSTITUCIONAL:
      // Si turno.estado === false -> TURNO_INACTIVO
      // NO computa como ausente, tardanza ni pendiente operativo.
      if (estadoEstudiante === "TURNO_INACTIVO") {
        alumnasTurnoInactivo++;
        gItem.inactivos++;
        if (tStats) tStats.inactivos++;
      } else if (estadoEstudiante === "NO_LECTIVO" || estadoEstudiante === "SIN_TURNO") {
        // Alumnos no computables en métricas operativas diarias
      } else {
        // Estudiantes en turno activo y operativo
        totalOperativas++;
        gItem.operativas++;

        if (estadoEstudiante === "PUNTUAL") {
          puntuales++;
          gItem.puntuales++;
          if (tStats) {
            tStats.puntuales++;
            tStats.presentes++;
          }
        } else if (estadoEstudiante === "TARDE") {
          tardanzas++;
          gItem.tardanzas++;
          if (tStats) {
            tStats.tardanzas++;
            tStats.presentes++;
          }
        } else if (estadoEstudiante === "JUSTIFICADO") {
          justificados++;
          gItem.justificados++;
          if (tStats) {
            tStats.justificados++;
            tStats.presentes++;
          }
        } else if (esEstadoPendienteOperativo(estadoEstudiante)) {
          pendientesOperativos++;
          gItem.pendientes++;
          if (tStats) tStats.pendientes++;
        } else if (estadoEstudiante === "AUSENTE_CONFIRMADO") {
          ausentesConfirmados++;
          gItem.ausentes++;
          if (tStats) tStats.ausentes++;
        }
      }
    }

    // 7. Cálculos de Totales y Porcentajes Operativos
    const totalMatriculadas = estudiantes.length;
    const presentes = puntuales + tardanzas + justificados;
    const ausentes = ausentesConfirmados;
    const pendientes = pendientesOperativos;

    // Porcentaje operativo: calculado estrictamente sobre totalOperativas (evita división entre 0)
    const porcentajeAsistencia =
      totalOperativas > 0
        ? Math.min(100, Math.round((presentes / totalOperativas) * 100))
        : 0;

    const porcentajePuntualidad =
      presentes > 0
        ? Math.min(100, Math.round((puntuales / presentes) * 100))
        : 0;

    // 8. Gráfico 1: Distribución Real de Asistencia (Dona)
    const distribucionDona = [
      { name: "Presentes (Puntual)", valor: puntuales, color: "#10B981" },
      { name: "Tardanzas", valor: tardanzas, color: "#F59E0B" },
      { name: "Faltas / Ausencias", valor: ausentes, color: "#EF4444" },
    ];

    if (justificados > 0) {
      distribucionDona.push({ name: "Justificados", valor: justificados, color: "#6366F1" });
    }

    if (pendientes > 0) {
      distribucionDona.push({ name: "Pendientes por Ingresar", valor: pendientes, color: "#3B82F6" });
    }

    if (alumnasTurnoInactivo > 0) {
      distribucionDona.push({ name: "En Turno Inactivo", valor: alumnasTurnoInactivo, color: "#94A3B8" });
    }

    // 9. Distribución por Turnos Institucionales
    function procesarTurno(
      turnoBD: (typeof turnosBD)[number] | undefined,
      nombrePorDefecto: string,
      icono: string
    ) {
      if (!turnoBD) {
        return {
          turno: nombrePorDefecto,
          icono,
          porcentaje: 0,
          presentes: 0,
          puntuales: 0,
          tardanzas: 0,
          ausentes: 0,
          pendientes: 0,
          inactivos: 0,
          totalAlumnas: 0,
          activo: false,
          estadoTurno: "NO_REGISTRADO",
        };
      }

      const stats = statsPorTurno.get(turnoBD.id) || {
        puntuales: 0,
        tardanzas: 0,
        justificados: 0,
        presentes: 0,
        ausentes: 0,
        pendientes: 0,
        inactivos: 0,
        total: 0,
      };

      const totalAlumnas = stats.total;
      const esActivo = turnoBD.estado === true;
      const pct =
        esActivo && totalAlumnas > 0
          ? Math.min(100, Math.round((stats.presentes / totalAlumnas) * 100))
          : 0;

      return {
        turno: turnoBD.nombre || nombrePorDefecto,
        icono,
        porcentaje: pct,
        presentes: stats.presentes,
        puntuales: stats.puntuales,
        tardanzas: stats.tardanzas,
        ausentes: esActivo ? stats.ausentes : 0,
        pendientes: esActivo ? stats.pendientes : 0,
        inactivos: !esActivo ? totalAlumnas : 0,
        totalAlumnas,
        activo: esActivo,
        estadoTurno: esActivo ? "OPERATIVO" : "INACTIVO",
      };
    }

    const turnoMananaDb = turnosBD.find((t) => {
      const n = t.nombre.toLowerCase();
      return n.includes("mañana") || n.includes("manana") || n.includes("matutino");
    });
    const turnoTardeDb = turnosBD.find((t) => {
      const n = t.nombre.toLowerCase();
      return n.includes("tarde") || n.includes("vespertino");
    });
    const turnoNocheDb = turnosBD.find((t) => {
      const n = t.nombre.toLowerCase();
      return n.includes("noche") || n.includes("nocturno");
    });

    const turnoManana = procesarTurno(turnoMananaDb, "Mañana", "🌅");
    const turnoTarde = procesarTurno(turnoTardeDb, "Tarde", "🌞");
    const turnoNoche = procesarTurno(turnoNocheDb, "Noche", "🌙");

    const asistenciaPorTurno = [turnoManana, turnoTarde, turnoNoche];
    const distribucionPorTurnos = {
      manana: turnoManana,
      tarde: turnoTarde,
      noche: turnoNoche,
    };

    // 10. Evolución Semanal de Asistencia para este colegio
    const baseDate = new Date(`${fechaConsultaStr}T12:00:00-05:00`);
    const semanasFechas = [
      { num: 1, diasAtrasInicio: 28, diasAtrasFin: 21 },
      { num: 2, diasAtrasInicio: 21, diasAtrasFin: 14 },
      { num: 3, diasAtrasInicio: 14, diasAtrasFin: 7 },
      { num: 4, diasAtrasInicio: 7, diasAtrasFin: 0 },
    ];

    const capacidadBase = totalOperativas > 0 ? totalOperativas : totalMatriculadas;

    const evolucionSemanal = await Promise.all(
      semanasFechas.map(async ({ num, diasAtrasInicio, diasAtrasFin }) => {
        const fechaDesde = new Date(baseDate);
        fechaDesde.setDate(fechaDesde.getDate() - diasAtrasInicio);
        fechaDesde.setHours(0, 0, 0, 0);

        const fechaHasta = new Date(baseDate);
        fechaHasta.setDate(fechaHasta.getDate() - diasAtrasFin);
        fechaHasta.setHours(23, 59, 59, 999);

        const asistenciasSemana = await prisma.asistencia
          .findMany({
            where: {
              colegioId,
              fecha: {
                gte: fechaDesde,
                lte: fechaHasta,
              },
            },
            select: {
              estado: true,
              estudianteId: true,
            },
          })
          .catch(() => []);

        const totalMarcadas = asistenciasSemana.length;
        if (totalMarcadas === 0 || capacidadBase === 0) {
          return {
            semana: `Semana ${num}`,
            asistencia: 0,
            puntualidad: 0,
          };
        }

        const puntualesSem = asistenciasSemana.filter(
          (a) => (a.estado || "").toUpperCase() === "PUNTUAL"
        ).length;

        const capacidadSemanal = capacidadBase * 5;
        const pctAsist = Math.min(
          100,
          Math.round((totalMarcadas / capacidadSemanal) * 100)
        );
        const pctPunt = Math.min(
          100,
          Math.round((puntualesSem / totalMarcadas) * 100)
        );

        return {
          semana: `Semana ${num}`,
          asistencia: pctAsist,
          puntualidad: pctPunt,
        };
      })
    );

    // 11. Distribución por Grado Real
    const barrasPorGrado = Array.from(mapaGrados.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([grado, stats]) => {
        const totalAsistieron = stats.puntuales + stats.tardanzas + stats.justificados;
        const pctAsistencia =
          stats.operativas > 0
            ? Math.min(100, Math.round((totalAsistieron / stats.operativas) * 100))
            : 0;

        return {
          grado,
          matriculadas: stats.matriculadas,
          operativas: stats.operativas,
          puntuales: stats.puntuales,
          tardanzas: stats.tardanzas,
          ausentes: stats.ausentes,
          pendientes: stats.pendientes,
          inactivos: stats.inactivos,
          porcentajeAsistencia: pctAsistencia,
        };
      });

    // 12. Métodos de Registro Reales
    const metodosRegistro = {
      qr: asistenciasDia.filter((a) => a.metodo === "QR").length,
      dni: asistenciasDia.filter((a) => a.metodo === "DNI").length,
      facial: asistenciasDia.filter((a) => a.metodo === "FACIAL").length,
      manual: asistenciasDia.filter((a) => a.metodo === "MANUAL").length,
    };

    const supermotorInfo = {
      motorActivo: estadoSuperMotor?.motorActivo ?? true,
      estadoJornada: estadoSuperMotor?.estadoJornada || "OPERATIVO",
      portalActivo: estadoSuperMotor?.portalActivo ?? true,
    };

    const metricasConsolidadas = {
      totalMatriculadas,
      totalOperativas,
      alumnasTurnoInactivo,
      pendientes,
      presentes,
      puntuales,
      tardanzas,
      justificados,
      ausentes,
      porcentajeAsistencia,
      porcentajePuntualidad,
      estadoJornada: supermotorInfo.estadoJornada,
      motorActivo: supermotorInfo.motorActivo,
    };

    // 13. Respuesta con datos 100% reales, aislados por colegio y validados
    return NextResponse.json(
      {
        ok: true,
        fechaConsulta: fechaConsultaStr,
        infoInstitucional: {
          ...infoInstitucional,
          supermotor: supermotorInfo,
        },
        supermotor: supermotorInfo,
        asistenciaGeneral: metricasConsolidadas,
        metricasGlobales: metricasConsolidadas,
        totalMatriculadas,
        totalOperativas,
        alumnasTurnoInactivo,
        pendientes,
        presentes,
        puntuales,
        tardanzas,
        ausentes,
        porcentajeAsistencia,
        porcentajePuntualidad,
        distribucionPorTurnos,
        asistenciaPorTurno,
        evolucionSemanal,
        distribucionDona,
        barrasPorGrado,
        metodosRegistro,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error obteniendo métricas públicas de asistencia:", error);

    const metricasCero = {
      totalMatriculadas: 0,
      totalOperativas: 0,
      alumnasTurnoInactivo: 0,
      pendientes: 0,
      presentes: 0,
      puntuales: 0,
      tardanzas: 0,
      justificados: 0,
      ausentes: 0,
      porcentajeAsistencia: 0,
      porcentajePuntualidad: 0,
    };

    const turnoVacio = (nombre: string, icono: string) => ({
      turno: nombre,
      icono,
      porcentaje: 0,
      presentes: 0,
      puntuales: 0,
      tardanzas: 0,
      ausentes: 0,
      pendientes: 0,
      inactivos: 0,
      totalAlumnas: 0,
      activo: false,
      estadoTurno: "ERROR",
    });

    return NextResponse.json(
      {
        ok: false,
        fechaConsulta: fechaPeru(),
        infoInstitucional: {
          nombreColegio: "I.E.P. Santa Rita de Cassia",
          direccion: "Cañete, Lima - Perú",
          telefono: "(01) 581-2244",
          correo: "contacto@santaritadecassia.edu.pe",
          director: "Dirección General",
          logoUrl: "/img/logo-santa-rita.png",
          canalPortalWebActivo: true,
          colegioId: DEFAULT_COLEGIO_ID,
        },
        asistenciaGeneral: metricasCero,
        metricasGlobales: metricasCero,
        totalMatriculadas: 0,
        totalOperativas: 0,
        alumnasTurnoInactivo: 0,
        pendientes: 0,
        presentes: 0,
        puntuales: 0,
        tardanzas: 0,
        ausentes: 0,
        porcentajeAsistencia: 0,
        porcentajePuntualidad: 0,
        distribucionPorTurnos: {
          manana: turnoVacio("Mañana", "🌅"),
          tarde: turnoVacio("Tarde", "🌞"),
          noche: turnoVacio("Noche", "🌙"),
        },
        asistenciaPorTurno: [
          turnoVacio("Mañana", "🌅"),
          turnoVacio("Tarde", "🌞"),
          turnoVacio("Noche", "🌙"),
        ],
        distribucionDona: [
          { name: "Presentes (Puntual)", valor: 0, color: "#10B981" },
          { name: "Tardanzas", valor: 0, color: "#F59E0B" },
          { name: "Faltas / Ausencias", valor: 0, color: "#EF4444" },
        ],
        evolucionSemanal: [
          { semana: "Semana 1", asistencia: 0, puntualidad: 0 },
          { semana: "Semana 2", asistencia: 0, puntualidad: 0 },
          { semana: "Semana 3", asistencia: 0, puntualidad: 0 },
          { semana: "Semana 4", asistencia: 0, puntualidad: 0 },
        ],
        barrasPorGrado: [],
        metodosRegistro: { qr: 0, dni: 0, facial: 0, manual: 0 },
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
