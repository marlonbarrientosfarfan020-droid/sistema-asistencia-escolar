import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json(
    { message: "No autorizado" },
    { status: 401 }
  );
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

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
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    let configuracion = await prisma.configuracion.findFirst();

    const data = {
      nombreColegio: body.nombreColegio || "Santa Rita de Casia",
      direccion: body.direccion || "",
      telefono: body.telefono || "",
      correo: body.correo || "",
      director: body.director || "",

      reporteTelegramActivo: Boolean(body.reporteTelegramActivo),
      horaReporteDiario: body.horaReporteDiario || "21:00",
      telegramDirectorChatId: body.telegramDirectorChatId || "",
      enviarReporteExcel: body.enviarReporteExcel === true,
      enviarReportePdf: body.enviarReportePdf === true,

      ultimoReporteTelegramEstado:
        body.ultimoReporteTelegramEstado || "",
    };

    if (!configuracion) {
      configuracion = await prisma.configuracion.create({
        data,
      });
    } else {
      configuracion = await prisma.configuracion.update({
        where: { id: configuracion.id },
        data,
      });
    }

    return NextResponse.json(configuracion);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al guardar configuración" },
      { status: 500 }
    );
  }
}