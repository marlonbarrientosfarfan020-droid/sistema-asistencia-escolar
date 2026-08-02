import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numeroSeguro(
  valor: unknown,
  minimo: number,
  maximo: number,
  valorDefecto: number
) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return valorDefecto;
  }

  return Math.min(
    Math.max(Math.trunc(numero), minimo),
    maximo
  );
}

async function obtenerConfiguracion() {
  let configuracion =
    await prisma.configuracion.findFirst({
      orderBy: {
        id: "asc",
      },
    });

  if (!configuracion) {
    configuracion =
      await prisma.configuracion.create({
        data: {},
      });
  }

  return configuracion;
}

export async function GET() {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const configuracion =
      await obtenerConfiguracion();

    return NextResponse.json({
      ok: true,

      automatizacionesActivas:
        configuracion.automatizacionesActivas,

      alertaIngresoPendienteActiva:
        configuracion.alertaIngresoPendienteActiva,

      minutosAlertaInicial:
        configuracion.minutosAlertaInicial,

      alertaTardanzaActiva:
        configuracion.alertaTardanzaActiva,

      alertaAusenciaActiva:
        configuracion.alertaAusenciaActiva,

      modoPruebaAlertas:
        configuracion.modoPruebaAlertas,

      telegramPruebaChatId:
        configuracion.telegramPruebaChatId,

      frecuenciaRevisionMinutos:
        configuracion.frecuenciaRevisionMinutos,

      ultimaEjecucionAutomatizaciones:
        configuracion.ultimaEjecucionAutomatizaciones,

      ultimaEjecucionEstado:
        configuracion.ultimaEjecucionEstado,
    });
  } catch (error) {
    console.error(
      "Error consultando automatizaciones:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo cargar la configuración de automatizaciones",
      },
      {
        status: 500,
      }
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

    const configuracionActual =
      await obtenerConfiguracion();

    const automatizacionesActivas =
      Boolean(body.automatizacionesActivas);

    const alertaIngresoPendienteActiva =
      Boolean(
        body.alertaIngresoPendienteActiva
      );

    const minutosAlertaInicial =
      numeroSeguro(
        body.minutosAlertaInicial,
        1,
        120,
        5
      );

    const alertaTardanzaActiva =
      Boolean(body.alertaTardanzaActiva);

    const alertaAusenciaActiva =
      Boolean(body.alertaAusenciaActiva);

    const modoPruebaAlertas =
      Boolean(body.modoPruebaAlertas);

    const telegramPruebaChatId =
      typeof body.telegramPruebaChatId ===
      "string"
        ? body.telegramPruebaChatId.trim()
        : "";

    const frecuenciaRevisionMinutos =
      numeroSeguro(
        body.frecuenciaRevisionMinutos,
        1,
        60,
        5
      );

    if (
      modoPruebaAlertas &&
      automatizacionesActivas &&
      !telegramPruebaChatId
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Ingrese el Telegram Chat ID de prueba antes de activar las automatizaciones en modo prueba",
        },
        {
          status: 400,
        }
      );
    }

    const configuracion =
      await prisma.configuracion.update({
        where: {
          id: configuracionActual.id,
        },

        data: {
          automatizacionesActivas,
          alertaIngresoPendienteActiva,
          minutosAlertaInicial,
          alertaTardanzaActiva,
          alertaAusenciaActiva,
          modoPruebaAlertas,
          telegramPruebaChatId,
          frecuenciaRevisionMinutos,
        },
      });

    return NextResponse.json({
      ok: true,
      message:
        "Configuración de automatizaciones guardada correctamente",

      configuracion: {
        automatizacionesActivas:
          configuracion.automatizacionesActivas,

        alertaIngresoPendienteActiva:
          configuracion.alertaIngresoPendienteActiva,

        minutosAlertaInicial:
          configuracion.minutosAlertaInicial,

        alertaTardanzaActiva:
          configuracion.alertaTardanzaActiva,

        alertaAusenciaActiva:
          configuracion.alertaAusenciaActiva,

        modoPruebaAlertas:
          configuracion.modoPruebaAlertas,

        telegramPruebaChatId:
          configuracion.telegramPruebaChatId,

        frecuenciaRevisionMinutos:
          configuracion.frecuenciaRevisionMinutos,

        ultimaEjecucionAutomatizaciones:
          configuracion.ultimaEjecucionAutomatizaciones,

        ultimaEjecucionEstado:
          configuracion.ultimaEjecucionEstado,
      },
    });
  } catch (error) {
    console.error(
      "Error guardando automatizaciones:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo guardar la configuración de automatizaciones",
      },
      {
        status: 500,
      }
    );
  }
}