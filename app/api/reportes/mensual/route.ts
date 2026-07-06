import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function esAdminODemo(request: Request) {
  const rol = request.headers.get("x-user-role") || "";
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);

    const mes = Number(searchParams.get("mes"));
    const anio = Number(searchParams.get("anio"));
    const turno = searchParams.get("turno") || "TODOS";
    const grado = searchParams.get("grado") || "TODOS";
    const seccion = searchParams.get("seccion") || "TODOS";

    if (!mes || !anio) {
      return NextResponse.json(
        { message: "Mes y año son obligatorios" },
        { status: 400 }
      );
    }

    const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);
    const totalDias = finMes.getDate();

    const estudiantes = await prisma.estudiante.findMany({
      where: {
        estado: true,
        ...(grado !== "TODOS" ? { grado } : {}),
        ...(seccion !== "TODOS" ? { seccion } : {}),
        ...(turno !== "TODOS"
          ? {
              turno: {
                nombre: turno,
              },
            }
          : {}),
      },
      include: {
        turno: true,
        asistencias: {
          where: {
            fecha: {
              gte: inicioMes,
              lte: finMes,
            },
          },
        },
      },
      orderBy: {
        apellidos: "asc",
      },
    });

    const detalle = estudiantes.map((estudiante) => {
      const presentes = estudiante.asistencias.length;

      const tardanzas = estudiante.asistencias.filter(
        (a) => a.estado === "TARDE"
      ).length;

      const puntuales = estudiante.asistencias.filter(
        (a) => a.estado === "PUNTUAL"
      ).length;

      const sinSalida = estudiante.asistencias.filter(
        (a) => a.horaEntrada && !a.horaSalida
      ).length;

      return {
        id: estudiante.id,
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        dni: estudiante.dni,
        grado: `${estudiante.grado} - ${estudiante.seccion}`,
        gradoSolo: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || "Sin turno",
        presentes,
        ausentes: Math.max(totalDias - presentes, 0),
        puntuales,
        tardanzas,
        sinSalida,
      };
    });

    const resumen = {
      totalEstudiantes: estudiantes.length,
      totalPresentes: detalle.reduce((acc, e) => acc + e.presentes, 0),
      totalAusentes: detalle.reduce((acc, e) => acc + e.ausentes, 0),
      totalPuntuales: detalle.reduce((acc, e) => acc + e.puntuales, 0),
      totalTardanzas: detalle.reduce((acc, e) => acc + e.tardanzas, 0),
      totalSinSalida: detalle.reduce((acc, e) => acc + e.sinSalida, 0),
    };

    return NextResponse.json({
      mes,
      anio,
      turno,
      grado,
      seccion,
      totalDias,
      resumen,
      detalle,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al generar reporte mensual" },
      { status: 500 }
    );
  }
}