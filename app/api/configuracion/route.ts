import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exigirAdminODirectivo,
  exigirAdminDirectivoODemo,
} from "@/lib/auth";
function horaValida(valor: unknown) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    String(valor || "")
  );
}

function diaSemanaValido(valor: unknown) {
  const dia = Number(valor);

  return (
    Number.isInteger(dia) &&
    dia >= 1 &&
    dia <= 7
  );
}

function diaMesValido(valor: unknown) {
  const dia = Number(valor);

  return (
    Number.isInteger(dia) &&
    dia >= 1 &&
    dia <= 28
  );
}

function frecuenciaValida(valor: unknown) {
  return ["SEMANAL", "MENSUAL"].includes(
    String(valor || "").toUpperCase()
  );
}

export async function GET() {
  const acceso = await exigirAdminDirectivoODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    let configuracion =
      await prisma.configuracion.findFirst();

    if (!configuracion) {
      configuracion =
        await prisma.configuracion.create({
          data: {
            nombreColegio:
              "Santa Rita de Casia",
          },
        });
    }

    return NextResponse.json(configuracion);
  } catch (error) {
    console.error(
      "Error obteniendo configuración:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al obtener configuración",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const frecuenciaReporteDirector =
      String(
        body.frecuenciaReporteDirector ||
          "SEMANAL"
      ).toUpperCase();

    const frecuenciaReportePadres =
      String(
        body.frecuenciaReportePadres ||
          "SEMANAL"
      ).toUpperCase();

    const diaReporteDirector = Number(
      body.diaReporteDirector || 5
    );

    const diaMesReporteDirector = Number(
      body.diaMesReporteDirector || 28
    );

    const diaReportePadres = Number(
      body.diaReportePadres || 5
    );

    const diaMesReportePadres = Number(
      body.diaMesReportePadres || 28
    );

    const horaReporteDirector = String(
      body.horaReporteDirector || "18:00"
    );

    const horaReportePadres = String(
      body.horaReportePadres || "19:00"
    );

    if (
      !frecuenciaValida(
        frecuenciaReporteDirector
      )
    ) {
      return NextResponse.json(
        {
          message:
            "La frecuencia del director debe ser SEMANAL o MENSUAL",
        },
        { status: 400 }
      );
    }

    if (
      !frecuenciaValida(
        frecuenciaReportePadres
      )
    ) {
      return NextResponse.json(
        {
          message:
            "La frecuencia para padres debe ser SEMANAL o MENSUAL",
        },
        { status: 400 }
      );
    }

    if (
      !diaSemanaValido(
        diaReporteDirector
      )
    ) {
      return NextResponse.json(
        {
          message:
            "El día semanal del director debe estar entre 1 y 7",
        },
        { status: 400 }
      );
    }

    if (
      !diaMesValido(
        diaMesReporteDirector
      )
    ) {
      return NextResponse.json(
        {
          message:
            "El día mensual del director debe estar entre 1 y 28",
        },
        { status: 400 }
      );
    }

    if (
      !diaSemanaValido(
        diaReportePadres
      )
    ) {
      return NextResponse.json(
        {
          message:
            "El día semanal para padres debe estar entre 1 y 7",
        },
        { status: 400 }
      );
    }

    if (
      !diaMesValido(
        diaMesReportePadres
      )
    ) {
      return NextResponse.json(
        {
          message:
            "El día mensual para padres debe estar entre 1 y 28",
        },
        { status: 400 }
      );
    }

    if (
      !horaValida(
        horaReporteDirector
      )
    ) {
      return NextResponse.json(
        {
          message:
            "La hora del director debe tener formato HH:mm",
        },
        { status: 400 }
      );
    }

    if (
      !horaValida(horaReportePadres)
    ) {
      return NextResponse.json(
        {
          message:
            "La hora para padres debe tener formato HH:mm",
        },
        { status: 400 }
      );
    }

    let configuracion =
      await prisma.configuracion.findFirst();

    const data = {
      nombreColegio:
        String(
          body.nombreColegio || ""
        ).trim() ||
        "Santa Rita de Casia",

      direccion: String(
        body.direccion || ""
      ).trim(),

      telefono: String(
        body.telefono || ""
      ).trim(),

      correo: String(
        body.correo || ""
      ).trim(),

      director: String(
        body.director || ""
      ).trim(),

      reporteTelegramActivo: Boolean(
        body.reporteDirectorActivo
      ),

      horaReporteDiario:
        horaReporteDirector,

      telegramDirectorChatId: String(
        body.telegramDirectorChatId || ""
      ).trim(),

      enviarReporteExcel:
        body.enviarReporteExcel === undefined
          ? true
          : Boolean(
              body.enviarReporteExcel
            ),

      enviarReportePdf:
        body.enviarReportePdf === undefined
          ? true
          : Boolean(
              body.enviarReportePdf
            ),

      ultimoReporteTelegramEstado:
        String(
          body.ultimoReporteTelegramEstado ||
            ""
        ),

      reporteDirectorActivo: Boolean(
        body.reporteDirectorActivo
      ),

      frecuenciaReporteDirector,
      diaReporteDirector,
      diaMesReporteDirector,
      horaReporteDirector,

      reportePadresActivo: Boolean(
        body.reportePadresActivo
      ),

      frecuenciaReportePadres,
      diaReportePadres,
      diaMesReportePadres,
      horaReportePadres,

      incluirRiesgoIAReportePadres:
        body.incluirRiesgoIAReportePadres ===
        undefined
          ? true
          : Boolean(
              body.incluirRiesgoIAReportePadres
            ),
    };

    if (!configuracion) {
      configuracion =
        await prisma.configuracion.create({
          data,
        });
    } else {
      configuracion =
        await prisma.configuracion.update({
          where: {
            id: configuracion.id,
          },
          data,
        });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Configuración guardada correctamente",
      configuracion,
    });
  } catch (error) {
    console.error(
      "Error guardando configuración:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al guardar configuración",
      },
      { status: 500 }
    );
  }
}