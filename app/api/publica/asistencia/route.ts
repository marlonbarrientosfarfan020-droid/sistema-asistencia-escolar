import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONA_HORARIA = "America/Lima";

function fechaPeruActual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaParam = searchParams.get("fecha");

    // 1. Configuración institucional real desde PostgreSQL (tabla Configuracion)
    const configuracion = await prisma.configuracion.findFirst({
      select: {
        nombreColegio: true,
        direccion: true,
        telefono: true,
        correo: true,
        director: true,
        logoUrl: true,
        canalPortalWebActivo: true,
      },
    }).catch(() => null);

    const infoInstitucional = {
      nombreColegio: configuracion?.nombreColegio || "I.E.P. Santa Rita de Cassia",
      direccion: configuracion?.direccion || "Cañete, Lima - Perú",
      telefono: configuracion?.telefono || "(01) 581-2244",
      correo: configuracion?.correo || "contacto@santaritadecassia.edu.pe",
      director: configuracion?.director || "Dirección General",
      logoUrl: configuracion?.logoUrl || "/img/logo-santa-rita.png",
      canalPortalWebActivo: configuracion?.canalPortalWebActivo ?? true,
    };

    // 2. Fecha de consulta (Formato YYYY-MM-DD en zona horaria America/Lima)
    const fechaConsultaStr = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)
      ? fechaParam
      : fechaPeruActual();

    const inicioDia = new Date(`${fechaConsultaStr}T00:00:00-05:00`);
    const finDia = new Date(`${fechaConsultaStr}T23:59:59.999-05:00`);

    // 3. Consultas reales a las mismas tablas que usa el Dashboard Administrativo
    // - Estudiante: tabla de alumnado activo
    // - Asistencia: tabla de marcaciones de asistencia
    // - Turno: tabla de turnos de la institución
    const [totalMatriculadas, asistenciasDia, estudiantesPorGrado, turnosBD] = await Promise.all([
      prisma.estudiante.count({
        where: { estado: true },
      }),
      prisma.asistencia.findMany({
        where: {
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
          estudiante: {
            select: {
              id: true,
              grado: true,
              seccion: true,
              turnoId: true,
              turno: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
      }),
      prisma.estudiante.groupBy({
        by: ["grado"],
        where: { estado: true },
        _count: { id: true },
        orderBy: { grado: "asc" },
      }),
      prisma.turno.findMany({
        where: { estado: true },
        include: {
          _count: {
            select: { estudiantes: { where: { estado: true } } },
          },
        },
        orderBy: { id: "asc" },
      }),
    ]);

    // 4. Consolidación de Asistencias Reales Únicas por Estudiante (evita duplicados si marcaron varias veces)
    const asistenciasPorEstudiante = new Map<number, (typeof asistenciasDia)[number]>();

    for (const a of asistenciasDia) {
      const actual = asistenciasPorEstudiante.get(a.estudianteId);
      if (!actual || (!actual.horaEntrada && a.horaEntrada)) {
        asistenciasPorEstudiante.set(a.estudianteId, a);
      }
    }

    // 5. Cálculo estricto de estadísticas reales (0 si la BD está vacía)
    let puntuales = 0;
    let tardanzas = 0;
    let justificados = 0;

    for (const a of asistenciasPorEstudiante.values()) {
      const st = (a.estado || "").toUpperCase();
      if (st === "TARDE" || st === "TARDANZA") {
        tardanzas++;
      } else if (st === "JUSTIFICADO") {
        justificados++;
      } else if (st === "PUNTUAL" || a.horaEntrada) {
        puntuales++;
      }
    }

    const presentes = puntuales + tardanzas + justificados;
    const ausentes = totalMatriculadas > 0 ? Math.max(0, totalMatriculadas - presentes) : 0;

    const porcentajeAsistencia =
      totalMatriculadas > 0 ? Math.min(100, Math.round((presentes / totalMatriculadas) * 100)) : 0;
    const porcentajePuntualidad =
      presentes > 0 ? Math.min(100, Math.round((puntuales / presentes) * 100)) : 0;

    // 6. Gráfico 1: Distribución Real de Asistencia
    const distribucionDona = [
      { name: "Presentes (Puntual)", valor: puntuales, color: "#10B981" },
      { name: "Tardanzas", valor: tardanzas, color: "#F59E0B" },
      { name: "Faltas / Ausencias", valor: ausentes, color: "#EF4444" },
    ];

    if (justificados > 0) {
      distribucionDona.push({ name: "Justificados", valor: justificados, color: "#6366F1" });
    }

    // 7. Distribución por Turnos Real (Mañana, Tarde, Noche)
    const mapaAsistenciasTurno = new Map<number, { puntuales: number; tardanzas: number; total: number }>();

    for (const a of asistenciasPorEstudiante.values()) {
      const tId = a.estudiante?.turnoId || 0;
      if (!mapaAsistenciasTurno.has(tId)) {
        mapaAsistenciasTurno.set(tId, { puntuales: 0, tardanzas: 0, total: 0 });
      }
      const item = mapaAsistenciasTurno.get(tId)!;
      const st = (a.estado || "").toUpperCase();
      if (st === "TARDE" || st === "TARDANZA") {
        item.tardanzas++;
      } else {
        item.puntuales++;
      }
      item.total++;
    }

    // Identificar turnos registrados en BD
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
          totalAlumnas: 0,
        };
      }

      const totalAlumnas = turnoBD._count.estudiantes || 0;
      const stats = mapaAsistenciasTurno.get(turnoBD.id) || { puntuales: 0, tardanzas: 0, total: 0 };
      const presentesTurno = stats.total;
      const ausentesTurno = totalAlumnas > 0 ? Math.max(0, totalAlumnas - presentesTurno) : 0;
      const pct = totalAlumnas > 0 ? Math.min(100, Math.round((presentesTurno / totalAlumnas) * 100)) : 0;

      return {
        turno: turnoBD.nombre || nombrePorDefecto,
        icono,
        porcentaje: pct,
        presentes: presentesTurno,
        puntuales: stats.puntuales,
        tardanzas: stats.tardanzas,
        ausentes: ausentesTurno,
        totalAlumnas,
      };
    }

    const turnoManana = procesarTurno(turnoMananaDb, "Mañana", "🌅");
    const turnoTarde = procesarTurno(turnoTardeDb, "Tarde", "🌞");
    const turnoNoche = procesarTurno(turnoNocheDb, "Noche", "🌙");

    const asistenciaPorTurno = [turnoManana, turnoTarde, turnoNoche];
    const distribucionPorTurnos = {
      manana: turnoManana,
      tarde: turnoTarde,
      noche: turnoNoche,
    };

    // 8. Gráfico 3: Evolución Semanal Real (Consulta de las últimas 4 semanas en la BD)
    const baseDate = new Date(`${fechaConsultaStr}T12:00:00-05:00`);
    
    // Obtener rangos para 4 semanas anteriores
    const semanasFechas = [
      { num: 1, diasAtrasInicio: 28, diasAtrasFin: 21 },
      { num: 2, diasAtrasInicio: 21, diasAtrasFin: 14 },
      { num: 3, diasAtrasInicio: 14, diasAtrasFin: 7 },
      { num: 4, diasAtrasInicio: 7, diasAtrasFin: 0 },
    ];

    const evolucionSemanal = await Promise.all(
      semanasFechas.map(async ({ num, diasAtrasInicio, diasAtrasFin }) => {
        const fechaDesde = new Date(baseDate);
        fechaDesde.setDate(fechaDesde.getDate() - diasAtrasInicio);
        fechaDesde.setHours(0, 0, 0, 0);

        const fechaHasta = new Date(baseDate);
        fechaHasta.setDate(fechaHasta.getDate() - diasAtrasFin);
        fechaHasta.setHours(23, 59, 59, 999);

        // Si es la semana 4 (semana actual de hoy), podemos usar los datos de hoy directamente si no hay más
        const asistenciasSemana = await prisma.asistencia.findMany({
          where: {
            fecha: {
              gte: fechaDesde,
              lte: fechaHasta,
            },
          },
          select: {
            estado: true,
            estudianteId: true,
          },
        }).catch(() => []);

        const totalMarcadas = asistenciasSemana.length;
        if (totalMarcadas === 0 || totalMatriculadas === 0) {
          return {
            semana: `Semana ${num}`,
            asistencia: 0,
            puntualidad: 0,
          };
        }

        const puntualesSem = asistenciasSemana.filter((a) => (a.estado || "").toUpperCase() === "PUNTUAL").length;
        // Asumiendo 5 días hábiles por semana
        const capacidadSemanal = totalMatriculadas * 5;
        const pctAsist = Math.min(100, Math.round((totalMarcadas / capacidadSemanal) * 100));
        const pctPunt = Math.min(100, Math.round((puntualesSem / totalMarcadas) * 100));

        return {
          semana: `Semana ${num}`,
          asistencia: pctAsist,
          puntualidad: pctPunt,
        };
      })
    );

    // 9. Distribución por Grado Real
    const mapaAsistenciasPorGrado = new Map<string, { puntuales: number; tardanzas: number; totalAsistieron: number }>();

    for (const a of asistenciasPorEstudiante.values()) {
      const g = a.estudiante?.grado;
      if (g) {
        if (!mapaAsistenciasPorGrado.has(g)) {
          mapaAsistenciasPorGrado.set(g, { puntuales: 0, tardanzas: 0, totalAsistieron: 0 });
        }
        const item = mapaAsistenciasPorGrado.get(g)!;
        const st = (a.estado || "").toUpperCase();
        if (st === "TARDE" || st === "TARDANZA") {
          item.tardanzas++;
        } else {
          item.puntuales++;
        }
        item.totalAsistieron++;
      }
    }

    const barrasPorGrado = estudiantesPorGrado.map((epg) => {
      const stats = mapaAsistenciasPorGrado.get(epg.grado) || {
        puntuales: 0,
        tardanzas: 0,
        totalAsistieron: 0,
      };
      const matriculadasEnGrado = epg._count.id || 0;
      const ausentesEnGrado = matriculadasEnGrado > 0 ? Math.max(0, matriculadasEnGrado - stats.totalAsistieron) : 0;
      const pctAsistencia =
        matriculadasEnGrado > 0
          ? Math.min(100, Math.round((stats.totalAsistieron / matriculadasEnGrado) * 100))
          : 0;

      return {
        grado: epg.grado,
        matriculadas: matriculadasEnGrado,
        puntuales: stats.puntuales,
        tardanzas: stats.tardanzas,
        ausentes: ausentesEnGrado,
        porcentajeAsistencia: pctAsistencia,
      };
    });

    // 10. Métodos de Registro Reales
    const metodosRegistro = {
      qr: asistenciasDia.filter((a) => a.metodo === "QR").length,
      dni: asistenciasDia.filter((a) => a.metodo === "DNI").length,
      facial: asistenciasDia.filter((a) => a.metodo === "FACIAL").length,
      manual: asistenciasDia.filter((a) => a.metodo === "MANUAL").length,
    };

    const metricasConsolidadas = {
      totalMatriculadas,
      presentes,
      puntuales,
      tardanzas,
      justificados,
      ausentes,
      porcentajeAsistencia,
      porcentajePuntualidad,
    };

    // 11. Respuesta con datos 100% reales de la base de datos
    return NextResponse.json(
      {
        ok: true,
        fechaConsulta: fechaConsultaStr,
        infoInstitucional,
        asistenciaGeneral: metricasConsolidadas,
        metricasGlobales: metricasConsolidadas,
        presentes,
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

    // En caso de error de conexión a la BD, devolver estrictamente ceros reales (NUNCA datos ficticios)
    const metricasCero = {
      totalMatriculadas: 0,
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
      totalAlumnas: 0,
    });

    return NextResponse.json(
      {
        ok: false,
        fechaConsulta: fechaPeruActual(),
        infoInstitucional: {
          nombreColegio: "I.E.P. Santa Rita de Cassia",
          direccion: "Cañete, Lima - Perú",
          telefono: "(01) 581-2244",
          correo: "contacto@santaritadecassia.edu.pe",
          director: "Dirección General",
          logoUrl: "/img/logo-santa-rita.png",
          canalPortalWebActivo: true,
        },
        asistenciaGeneral: metricasCero,
        metricasGlobales: metricasCero,
        presentes: 0,
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
