import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDemoOPersonal } from "@/lib/auth";
import {
  fechaPeru,
  horaPeru,
  obtenerLimitesDiaPeru,
  obtenerVentanaTurno,
} from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ClaveTurnoRanking = "MANANA" | "TARDE" | "NOCHE";

export interface RegistroRankingVivo {
  id: number;
  puesto: number;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  dni: string;
  grado: string;
  seccion: string;
  turnoNombre: string;
  turnoClave: ClaveTurnoRanking;
  horaEntrada: string | null;
  estado: string;
  horaSalida: string | null;
  estadoSalida: string;
  estadoJornada: string;
  metodo: string;
  updatedAt: string;
  tipoMovimiento: "ENTRADA_PUNTUAL" | "ENTRADA_TARDE" | "SALIDA";
}

export interface GrupoTurnoRanking {
  turnoClave: ClaveTurnoRanking;
  etiqueta: string;
  horarioReferencia: string;
  totalPresentes: number;
  totalPuntuales: number;
  totalTardanzas: number;
  totalSalidas: number;
  primerosEnLlegar: RegistroRankingVivo[];
  tardanzasTurno: RegistroRankingVivo[];
  salidasTurno: RegistroRankingVivo[];
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function clasificarTurno(
  nombreTurno?: string | null,
  horaEntradaTurno?: string | null,
  fechaHoraEntrada?: Date | null
): ClaveTurnoRanking {
  const limpio = normalizarTexto(nombreTurno || "");

  if (limpio.includes("TARDE") || limpio.includes("VESPERTIN")) {
    return "TARDE";
  }
  if (limpio.includes("NOCHE") || limpio.includes("NOCTURN")) {
    return "NOCHE";
  }
  if (limpio.includes("MANANA") || limpio.includes("MATUTIN")) {
    return "MANANA";
  }

  const refHora =
    horaEntradaTurno && /^\d{2}:\d{2}$/.test(horaEntradaTurno)
      ? horaEntradaTurno
      : fechaHoraEntrada
        ? horaPeru(fechaHoraEntrada)
        : "07:30";

  const horaNum = Number(refHora.split(":")[0] || 7);
  if (horaNum >= 18 || horaNum < 4) return "NOCHE";
  if (horaNum >= 12 && horaNum < 18) return "TARDE";
  return "MANANA";
}

function etiquetaDeTurno(clave: ClaveTurnoRanking): string {
  if (clave === "MANANA") return "MAÑANA";
  if (clave === "TARDE") return "TARDE";
  return "NOCHE";
}

export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const colegioId = acceso.sesion.colegioId || "SANTA_RITA_001";
    const { searchParams } = new URL(request.url);

    const hoy = fechaPeru();
    const fechaParam = (searchParams.get("fecha") || "").trim();
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoy;

    const gradoParam = (searchParams.get("grado") || "").trim();
    const seccionParam = (searchParams.get("seccion") || "").trim().toUpperCase();

    const ahora = new Date();
    const { inicioDia, finDia } = obtenerLimitesDiaPeru(fecha);

    // 1. Obtener turnos activos del colegio para evaluar ventanas (incluyendo Turno Noche que cruza medianoche)
    const turnosColegio = await prisma.turno.findMany({
      where: {
        colegioId,
        estado: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const fechasDiaValidas = new Set<string>([fecha]);
    const horariosPorTurno: Record<ClaveTurnoRanking, string> = {
      MANANA: "07:30 - 13:00",
      TARDE: "13:00 - 18:00",
      NOCHE: "18:30 - 22:30",
    };

    for (const t of turnosColegio) {
      const clave = clasificarTurno(t.nombre, t.horaEntrada, null);
      horariosPorTurno[clave] = `${t.horaEntrada} - ${t.horaSalida}`;

      const ventana = obtenerVentanaTurno({
        horaEntrada: t.horaEntrada,
        horaSalida: t.horaSalida,
        margenEntradaAnticipadaMinutos: t.margenEntradaAnticipadaMinutos ?? 60,
        margenSalidaAnticipadaMinutos: t.margenSalidaAnticipadaMinutos ?? 0,
        margenSalidaMinutos: t.margenSalidaMinutos ?? 60,
        ahora,
      });

      if (fecha === hoy && ventana.cruzaMedianoche && ventana.fechaBase) {
        fechasDiaValidas.add(ventana.fechaBase);
      }
    }

    // 2. Obtener grados y secciones disponibles para poblar los selectores de filtro
    const agrupacionGrados = await prisma.estudiante.findMany({
      where: {
        colegioId,
        estado: true,
      },
      select: {
        grado: true,
        seccion: true,
      },
      distinct: ["grado", "seccion"],
    });

    const gradosDisponibles = Array.from(
      new Set(agrupacionGrados.map((g) => g.grado.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

    const seccionesDisponibles = Array.from(
      new Set(
        agrupacionGrados
          .filter((g) => !gradoParam || g.grado.trim() === gradoParam)
          .map((g) => g.seccion.trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es"));

    const gradosSecciones = agrupacionGrados
      .map((g) => ({
        grado: g.grado.trim(),
        seccion: g.seccion.trim().toUpperCase(),
        etiqueta: `${g.grado.trim()} - ${g.seccion.trim().toUpperCase()}`,
      }))
      .sort((a, b) => {
        const comp = a.grado.localeCompare(b.grado, "es", { numeric: true });
        if (comp !== 0) return comp;
        return a.seccion.localeCompare(b.seccion, "es");
      });

    // 3. Consultar todas las asistencias del día filtradas por colegioId, fechaDia y grado/sección
    const asistenciasDia = await prisma.asistencia.findMany({
      where: {
        colegioId,
        OR: [
          { fechaDia: { in: Array.from(fechasDiaValidas) } },
          {
            fechaDia: "",
            fecha: {
              gte: inicioDia,
              lte: finDia,
            },
          },
        ],
        estudiante: {
          colegioId,
          estado: true,
          ...(gradoParam ? { grado: gradoParam } : {}),
          ...(seccionParam ? { seccion: seccionParam } : {}),
        },
      },
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
        turno: true,
      },
      orderBy: [
        { horaEntrada: "asc" },
        { fecha: "asc" },
      ],
    });

    // 4. Agrupar y separar por cada turno (MANANA, TARDE, NOCHE)
    const mapaTurnos: Record<ClaveTurnoRanking, typeof asistenciasDia> = {
      MANANA: [],
      TARDE: [],
      NOCHE: [],
    };

    for (const reg of asistenciasDia) {
      const turnoObj = reg.turno || reg.estudiante.turno;
      const fechaIngreso = reg.horaEntrada ? new Date(reg.horaEntrada) : new Date(reg.fecha);
      const claveTurno = clasificarTurno(
        turnoObj?.nombre,
        turnoObj?.horaEntrada,
        fechaIngreso
      );
      mapaTurnos[claveTurno].push(reg);
    }

    const todosLosRegistrosProcesados: RegistroRankingVivo[] = [];

    const construirGrupoTurno = (clave: ClaveTurnoRanking): GrupoTurnoRanking => {
      // Ordenar estrictamente por horaEntrada ASCENDENTE (desde el primero que ingresó)
      const registrosOrdenados = [...mapaTurnos[clave]].sort((a, b) => {
        const tA = new Date(a.horaEntrada || a.fecha).getTime();
        const tB = new Date(b.horaEntrada || b.fecha).getTime();
        if (tA !== tB) return tA - tB;
        return a.id - b.id;
      });

      const primerosEnLlegar: RegistroRankingVivo[] = [];
      const tardanzasTurno: RegistroRankingVivo[] = [];
      const salidasTurno: RegistroRankingVivo[] = [];

      let contadorPuntual = 0;
      let contadorTardanza = 0;

      for (const item of registrosOrdenados) {
        const estadoUpper = String(item.estado || "PUNTUAL").toUpperCase();
        const esTarde = estadoUpper === "TARDE";
        const tieneSalida = Boolean(item.horaSalida);

        const puestoAsignado = esTarde
          ? ++contadorTardanza
          : ++contadorPuntual;

        const estadoSalidaCalculado =
          item.estadoSalida ||
          (tieneSalida
            ? "SALIDA_NORMAL"
            : item.estadoJornada === "SIN_SALIDA"
              ? "SIN_SALIDA"
              : "PENDIENTE");

        const estadoJornadaCalculado =
          item.estadoJornada || (tieneSalida ? "CERRADA" : "ABIERTA");

        const fechaIngresoIso = item.horaEntrada
          ? new Date(item.horaEntrada).toISOString()
          : new Date(item.fecha).toISOString();

        const fechaSalidaIso = item.horaSalida
          ? new Date(item.horaSalida).toISOString()
          : null;

        const updatedAtIso = fechaSalidaIso || fechaIngresoIso;

        const tipoMovimiento: "ENTRADA_PUNTUAL" | "ENTRADA_TARDE" | "SALIDA" =
          tieneSalida
            ? "SALIDA"
            : esTarde
              ? "ENTRADA_TARDE"
              : "ENTRADA_PUNTUAL";

        const apellidos = (item.estudiante.apellidos || "").trim();
        const nombres = (item.estudiante.nombres || "").trim();

        const registro: RegistroRankingVivo = {
          id: item.id,
          puesto: puestoAsignado,
          apellidos,
          nombres,
          nombreCompleto: `${apellidos} ${nombres}`.trim(),
          dni: item.estudiante.dni,
          grado: item.estudiante.grado,
          seccion: item.estudiante.seccion,
          turnoNombre: etiquetaDeTurno(clave),
          turnoClave: clave,
          horaEntrada: fechaIngresoIso,
          estado: esTarde ? "TARDE" : "PUNTUAL",
          horaSalida: fechaSalidaIso,
          estadoSalida: estadoSalidaCalculado.replace(/_/g, " "),
          estadoJornada: estadoJornadaCalculado.replace(/_/g, " "),
          metodo: item.metodo || "QR",
          updatedAt: updatedAtIso,
          tipoMovimiento,
        };

        if (esTarde) {
          tardanzasTurno.push(registro);
        } else {
          primerosEnLlegar.push(registro);
        }

        if (tieneSalida) {
          salidasTurno.push(registro);
        }

        todosLosRegistrosProcesados.push(registro);
      }

      // Ordenar salidasTurno por horaSalida DESC (últimas salidas primero)
      salidasTurno.sort((a, b) => {
        const tA = a.horaSalida ? new Date(a.horaSalida).getTime() : 0;
        const tB = b.horaSalida ? new Date(b.horaSalida).getTime() : 0;
        return tB - tA;
      });

      return {
        turnoClave: clave,
        etiqueta: etiquetaDeTurno(clave),
        horarioReferencia: horariosPorTurno[clave],
        totalPresentes: registrosOrdenados.length,
        totalPuntuales: primerosEnLlegar.length,
        totalTardanzas: tardanzasTurno.length,
        totalSalidas: salidasTurno.length,
        primerosEnLlegar,
        tardanzasTurno,
        salidasTurno,
      };
    };

    const turnoManana = construirGrupoTurno("MANANA");
    const turnoTarde = construirGrupoTurno("TARDE");
    const turnoNoche = construirGrupoTurno("NOCHE");

    // 5. Movimientos en vivo: los últimos 20 eventos de entrada o salida registrados en el día (ordenados por updatedAt DESC)
    const movimientosEnVivo = [...todosLosRegistrosProcesados]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 20);

    return NextResponse.json(
      {
        ok: true,
        fecha,
        actualizadoEn: new Date().toISOString(),
        filtros: {
          grado: gradoParam,
          seccion: seccionParam,
          gradosDisponibles,
          seccionesDisponibles,
          gradosSecciones,
        },
        resumenGlobal: {
          totalPresentes:
            turnoManana.totalPresentes +
            turnoTarde.totalPresentes +
            turnoNoche.totalPresentes,
          totalPuntuales:
            turnoManana.totalPuntuales +
            turnoTarde.totalPuntuales +
            turnoNoche.totalPuntuales,
          totalTardanzas:
            turnoManana.totalTardanzas +
            turnoTarde.totalTardanzas +
            turnoNoche.totalTardanzas,
          totalSalidas:
            turnoManana.totalSalidas +
            turnoTarde.totalSalidas +
            turnoNoche.totalSalidas,
        },
        turnos: {
          MANANA: turnoManana,
          TARDE: turnoTarde,
          NOCHE: turnoNoche,
        },
        movimientosEnVivo,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error en GET /api/ranking-vivo:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo obtener el ranking de llegada en vivo",
      },
      { status: 500 }
    );
  }
}

