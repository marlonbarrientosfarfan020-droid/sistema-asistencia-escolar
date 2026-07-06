import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function esAdminODemo(request: Request) {
  const rol = request.headers.get("x-user-role") || "";
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

function hora(fecha: Date | null | undefined) {
  if (!fecha) return "-";

  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);

    const dni = String(searchParams.get("dni") || "").trim();
    const mes = Number(searchParams.get("mes"));
    const anio = Number(searchParams.get("anio"));

    if (!dni || !mes || !anio) {
      return NextResponse.json(
        { message: "DNI, mes y año son obligatorios" },
        { status: 400 }
      );
    }

    const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);
    const totalDias = finMes.getDate();

    const estudiante = await prisma.estudiante.findUnique({
      where: { dni },
      include: {
        turno: true,
        asistencias: {
          where: {
            fecha: {
              gte: inicioMes,
              lte: finMes,
            },
          },
          orderBy: {
            fecha: "asc",
          },
        },
      },
    });

    if (!estudiante) {
      return NextResponse.json(
        { message: "Estudiante no encontrado" },
        { status: 404 }
      );
    }

    const presentes = estudiante.asistencias.length;
    const puntuales = estudiante.asistencias.filter(
      (a) => a.estado === "PUNTUAL"
    ).length;
    const tardanzas = estudiante.asistencias.filter(
      (a) => a.estado === "TARDE"
    ).length;
    const sinSalida = estudiante.asistencias.filter(
      (a) => a.horaEntrada && !a.horaSalida
    ).length;

    const detalle = estudiante.asistencias.map((a) => ({
      id: a.id,
      fecha: a.fecha,
      entrada: hora(a.horaEntrada),
      salida: hora(a.horaSalida),
      estado: a.estado,
      metodo: a.metodo,
    }));

    return NextResponse.json({
      estudiante: {
        id: estudiante.id,
        codigo: estudiante.codigo,
        dni: estudiante.dni,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || "Sin turno",
      },
      resumen: {
        totalDias,
        presentes,
        ausentes: Math.max(totalDias - presentes, 0),
        puntuales,
        tardanzas,
        sinSalida,
      },
      detalle,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al generar reporte del estudiante" },
      { status: 500 }
    );
  }
}