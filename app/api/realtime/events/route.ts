import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { obtenerSesionPadre } from "@/lib/auth-padres";
import { prisma } from "@/lib/prisma";
import {
  subscribeEvent,
  EventoEscolar,
  COLEGIO_DEFAULT_ID,
} from "@/lib/events/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/realtime/events
 * Endpoint Server-Sent Events (SSE) para comunicación en tiempo real.
 * Compatible con Next.js App Router y Vercel Serverless.
 */
export async function GET(request: Request) {
  // 1. Validar autenticación: Personal/Admin O Portal de Familias
  const sesionPersonal = await obtenerSesion(request);
  let sesionPadre = null;

  if (!sesionPersonal) {
    sesionPadre = await obtenerSesionPadre();
  }

  if (!sesionPersonal && !sesionPadre) {
    return NextResponse.json(
      {
        ok: false,
        message: "No autorizado. Debe iniciar sesión para conectarse al canal de eventos en tiempo real.",
      },
      { status: 401 }
    );
  }

  // Obtener IDs de estudiantes si es sesión familiar para filtrado de seguridad
  let estudiantesIdsFamilia: number[] = [];
  if (sesionPadre) {
    try {
      const estudiantes = await prisma.estudiante.findMany({
        where: { codigoFamiliarId: sesionPadre.codigoFamiliarId },
        select: { id: true },
      });
      estudiantesIdsFamilia = estudiantes.map((e) => e.id);
    } catch (error) {
      console.error("[SSE] Error consultando estudiantes de la familia:", error);
    }
  }

  const colegioId = sesionPersonal?.colegioId || COLEGIO_DEFAULT_ID;
  const esPersonal = Boolean(sesionPersonal);
  const esSuperAdmin = sesionPersonal?.rol === "SUPER_ADMIN";
  const nombreIdentidad = esPersonal
    ? sesionPersonal?.usuario
    : sesionPadre?.tutorTitular;

  console.log(
    `[SSE] Nueva conexión establecida: ${nombreIdentidad} (${
      esPersonal ? sesionPersonal?.rol : "PADRE_FAMILIA"
    }) - Colegio: ${colegioId}`
  );

  const encoder = new TextEncoder();

  // 2. Crear ReadableStream para SSE
  const stream = new ReadableStream({
    start(controller) {
      // Enviar evento de confirmación de conexión
      const payloadConexion = {
        ok: true,
        mensaje: "Conectado al SuperMotor Escolar en tiempo real",
        colegioId,
        rol: esPersonal ? sesionPersonal?.rol : "FAMILIA",
        usuario: nombreIdentidad,
        conectadoAt: new Date().toISOString(),
      };

      controller.enqueue(
        encoder.encode(
          `event: CONECTADO\ndata: ${JSON.stringify(payloadConexion)}\n\n`
        )
      );

      // Listener para despachar eventos del bus
      const listener = (evento: EventoEscolar) => {
        try {
          // Seguridad FASE 8.4: Filtrado estricto por colegio
          const colegioEvento = !evento.colegioId || evento.colegioId === "default" ? COLEGIO_DEFAULT_ID : evento.colegioId;
          if (!esSuperAdmin && colegioEvento !== colegioId) {
            return; // Descartar evento de otra institución
          }

          // Si es familiar, solo recibir eventos de asistencia de sus hijas
          if (sesionPadre) {
            if (
              evento.tipo === "ASISTENCIA_REGISTRADA" ||
              evento.tipo === "ASISTENCIA_SALIDA" ||
              evento.tipo === "SALIDA_EXCEPCIONAL_REGISTRADA"
            ) {
              const estudianteId = evento.datos?.estudianteId;
              if (
                !estudianteId ||
                !estudiantesIdsFamilia.includes(Number(estudianteId))
              ) {
                return; // No es su hija, ignorar por privacidad
              }
            } else if (
              evento.tipo !== "SUPERMOTOR_CAMBIO_ESTADO" &&
              evento.tipo !== "ALERTA_GENERADA"
            ) {
              return; // Omitir eventos internos administrativos para padres
            }
          }

          // Enviar formato SSE estándar
          const mensajeSse = `event: ${evento.tipo}\ndata: ${JSON.stringify(
            evento.datos || evento
          )}\n\n`;

          controller.enqueue(encoder.encode(mensajeSse));
        } catch (err) {
          console.error("[SSE] Error despachando evento al cliente:", err);
        }
      };

      // Suscribirse a todos los eventos del bus
      const unsubscribe = subscribeEvent(listener);

      // Heartbeat cada 15 segundos para mantener viva la conexión en Vercel/proxies
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Manejar desconexión limpia del cliente
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Ya cerrado
        }
        console.log(`[SSE] Conexión cerrada limpiamente para: ${nombreIdentidad}`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Desactivar buffer en Nginx / proxies
    },
  });
}
