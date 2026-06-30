import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let configuracion = await prisma.configuracion.findFirst();

  if (!configuracion) {
    configuracion = await prisma.configuracion.create({
      data: {
        nombreColegio: "Santa Rita de Casia",
      },
    });
  }

  return NextResponse.json(configuracion);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    let configuracion = await prisma.configuracion.findFirst();

    if (!configuracion) {
      configuracion = await prisma.configuracion.create({
        data: {
          nombreColegio: body.nombreColegio || "Santa Rita de Casia",
          direccion: body.direccion || "",
          telefono: body.telefono || "",
          correo: body.correo || "",
          director: body.director || "",
          horaEntrada: body.horaEntrada || "07:30",
          tiempoMinSalida: Number(body.tiempoMinSalida || 30),
        },
      });

      return NextResponse.json(configuracion);
    }

    configuracion = await prisma.configuracion.update({
      where: { id: configuracion.id },
      data: {
        nombreColegio: body.nombreColegio || "Santa Rita de Casia",
        direccion: body.direccion || "",
        telefono: body.telefono || "",
        correo: body.correo || "",
        director: body.director || "",
        horaEntrada: body.horaEntrada || "07:30",
        tiempoMinSalida: Number(body.tiempoMinSalida || 30),
      },
    });

    return NextResponse.json(configuracion);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al guardar configuración" },
      { status: 500 }
    );
  }
}