import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  exigirAdmin,
  exigirAdminODemo,
} from "@/lib/auth";

function horaValida(valor: unknown) {
  return /^\d{2}:\d{2}$/.test(String(valor || ""));
}

function diaValido(valor: unknown) {
  const dia = Number(valor);
  return Number.isInteger(dia) && dia >= 1 && dia <= 7;
}

function frecuenciaValida(valor: unknown) {
  return ["DIARIO", "SEMANAL"].includes(
    String(valor || "").toUpperCase()
  );
}

export async function GET() {
  const acceso = await exigirAdminODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    let configuracion = await prisma.configuracion.findFirst();

    if (!configuracion) {
      configuracion = await prisma.configuracion.create({
        data: {
          nombreColegio: "Santa Rita de Casia",
        },
      });
    }

    return NextResponse.json(configuracion);
  } catch (error) {
    console.error("Error obteniendo configuración:", error);

    return NextResponse.json(
      { message: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const frecuenciaReporteDirector = String(
      body.frecuenciaReporteDirector || "DIARIO"
    ).toUpperCase();

    const diaReporteDirector = Number(
      body.diaReporteDirector || 1
    );

    const diaReportePadres = Number(
      body.diaReportePadres || 5
    );

    const horaReporteDirector = String(
      body.horaReporteDirector || "21:00"
    );

    const horaReportePadres = String(
      body.horaReportePadres || "18:00"
    );

    if (!frecuenciaValida(frecuenciaReporteDirector)) {
      return NextResponse.json(
        {
          message:
            "La frecuencia del reporte del director debe ser DIARIO o SEMANAL",
        },
        { status: 400 }
      );
    }

    if (!diaValido(diaReporteDirector)) {
      return NextResponse.json(
        {
          message:
            "El día del reporte del director debe estar entre 1 y 7",
        },
        { status: 400 }
      );
    }

    if (!diaValido(diaReportePadres)) {
      return NextResponse.json(
        {
          message:
            "El día del reporte para padres debe estar entre 1 y 7",
        },
        { status: 400 }
      );
    }

    if (!horaValida(horaReporteDirector)) {
      return NextResponse.json(
        {
          message:
            "La hora del reporte del director debe tener formato HH:mm",
        },
        { status: 400 }
      );
    }

    if (!horaValida(horaReportePadres)) {
      return NextResponse.json(
        {
          message:
            "La hora del reporte para padres debe tener formato HH:mm",
        },
        { status: 400 }
      );
    }

    let configuracion = await prisma.configuracion.findFirst();

    const data = {
      nombreColegio: String(
        body.nombreColegio || "Santa Rita de Casia"
      ).trim(),

      direccion: String(body.direccion || "").trim(),
      telefono: String(body.telefono || "").trim(),
      correo: String(body.correo || "").trim(),
      director: String(body.director || "").trim(),

      // Configuración anterior
      reporteTelegramActivo: Boolean(
        body.reporteTelegramActivo
      ),

      horaReporteDiario: String(
        body.horaReporteDiario || "21:00"
      ),

      telegramDirectorChatId: String(
        body.telegramDirectorChatId || ""
      ).trim(),

      enviarReporteExcel:
        body.enviarReporteExcel === undefined
          ? true
          : Boolean(body.enviarReporteExcel),

      enviarReportePdf:
        body.enviarReportePdf === undefined
          ? true
          : Boolean(body.enviarReportePdf),

      ultimoReporteTelegramEstado: String(
        body.ultimoReporteTelegramEstado || ""
      ),

      // Reporte automático para el director
      reporteDirectorActivo: Boolean(
        body.reporteDirectorActivo
      ),

      frecuenciaReporteDirector,
      diaReporteDirector,
      horaReporteDirector,

      // Reporte semanal para padres
      reportePadresActivo: Boolean(
        body.reportePadresActivo
      ),

      diaReportePadres,
      horaReportePadres,

      incluirRiesgoIAReportePadres:
        body.incluirRiesgoIAReportePadres === undefined
          ? true
          : Boolean(body.incluirRiesgoIAReportePadres),
    };

    if (!configuracion) {
      configuracion = await prisma.configuracion.create({
        data,
      });
    } else {
      configuracion = await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },
        data,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Configuración guardada correctamente",
      configuracion,
    });
  } catch (error) {
    console.error("Error guardando configuración:", error);

    return NextResponse.json(
      { message: "Error al guardar configuración" },
      { status: 500 }
    );
  }
}