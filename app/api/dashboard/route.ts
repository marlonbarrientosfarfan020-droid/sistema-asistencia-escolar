import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const configuracion = await prisma.configuracion.findFirst();

    const horaEntradaConfig = configuracion?.horaEntrada || "07:30";
    const [hora, minuto] = horaEntradaConfig.split(":").map(Number);

    const horaLimite = new Date();
    horaLimite.setHours(hora, minuto, 0, 0);

    const totalEstudiantes = await prisma.estudiante.count({
      where: {
        estado: true,
      },
    });

    const asistenciasHoy = await prisma.asistencia.findMany({
      where: {
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    const ultimasAsistencias = await prisma.asistencia.findMany({
      take: 8,
      orderBy: {
        fecha: "desc",
      },
      include: {
        estudiante: true,
      },
    });

    const presentes = asistenciasHoy.length;
    const ausentes = totalEstudiantes - presentes;

    const entradas = asistenciasHoy.filter((a) => a.horaEntrada !== null).length;

    const salidas = asistenciasHoy.filter((a) => a.horaSalida !== null).length;
    const sinSalida = asistenciasHoy.filter(
  (a) => a.horaEntrada && !a.horaSalida
).length;

    const tardanzas = asistenciasHoy.filter(
      (a) => a.horaEntrada && a.horaEntrada > horaLimite
    ).length;

    return NextResponse.json({
      totalEstudiantes,
      presentes,
      ausentes,
      entradas,
      salidas,
      tardanzas,
      sinSalida,
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