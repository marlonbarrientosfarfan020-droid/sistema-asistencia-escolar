import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const configuracion = await prisma.configuracion.findFirst();

    const totalEstudiantes = await prisma.estudiante.count({
      where: { estado: true },
    });

    const asistenciasHoy = await prisma.asistencia.findMany({
      where: {
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
      },
    });

    const ultimasAsistencias = await prisma.asistencia.findMany({
      take: 8,
      orderBy: {
        fecha: "desc",
      },
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
      },
    });

    const turnos = await prisma.turno.findMany({
      where: { estado: true },
      orderBy: { id: "asc" },
    });

    const presentes = asistenciasHoy.length;
    const ausentes = Math.max(totalEstudiantes - presentes, 0);

    const entradas = asistenciasHoy.filter((a) => a.horaEntrada !== null).length;
    const salidas = asistenciasHoy.filter((a) => a.horaSalida !== null).length;

    const sinSalida = asistenciasHoy.filter(
      (a) => a.horaEntrada && !a.horaSalida
    ).length;

    const puntuales = asistenciasHoy.filter(
      (a) => a.estado === "PUNTUAL"
    ).length;

    const tardanzas = asistenciasHoy.filter(
      (a) => a.estado === "TARDE"
    ).length;

    const resumenTurnos = await Promise.all(
      turnos.map(async (turno) => {
        const total = await prisma.estudiante.count({
          where: {
            estado: true,
            turnoId: turno.id,
          },
        });

        const asistenciasTurno = asistenciasHoy.filter(
          (a) => a.estudiante.turnoId === turno.id
        );

        return {
          id: turno.id,
          nombre: turno.nombre,
          horaEntrada: turno.horaEntrada,
          horaSalida: turno.horaSalida,
          total,
          presentes: asistenciasTurno.length,
          ausentes: Math.max(total - asistenciasTurno.length, 0),
          puntuales: asistenciasTurno.filter((a) => a.estado === "PUNTUAL")
            .length,
          tardanzas: asistenciasTurno.filter((a) => a.estado === "TARDE")
            .length,
          sinSalida: asistenciasTurno.filter(
            (a) => a.horaEntrada && !a.horaSalida
          ).length,
        };
      })
    );

    return NextResponse.json({
      totalEstudiantes,
      presentes,
      ausentes,
      entradas,
      salidas,
      puntuales,
      tardanzas,
      sinSalida,
      horaReporteDiario: configuracion?.horaReporteDiario || "21:00",
      ultimoReporteTelegramAt: configuracion?.ultimoReporteTelegramAt || null,
      ultimoReporteTelegramEstado:
        configuracion?.ultimoReporteTelegramEstado || "",
      resumenTurnos,
      ultimasAsistencias,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}