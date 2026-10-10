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
 * Endpoint Server-Sent Events (SSE) para comunicaci�n en tiempo real.
 * Compatible con Next.js App Router y Vercel Serverless.
 */
export async function GET(request: Request) {
  // 1. Validar autenticaci�n: Personal/Admin O Portal de Familias
  const sesionPersonal = await obtenerSesion(request);
  let sesionPadre = null;

  if (!sesionPersonal) {
    sesionPadre = await obtenerSesionPadre(request);
  }

  if (!sesionPersonal && !sesionPadre) {
    return NextResponse.json(
      {
        ok: false,
        message: "No autorizado. Debe iniciar sesi�n para conectarse al canal de eventos en tiempo real.",
      },
      { status: 401 }
    );
  }

  // Obtener IDs de estudiantes autorizados para filtrado estricto de privacidad familiar
  let estudiantesIdsFamilia: number[] = [];
  if (sesionPadre) {
    // REGLA DE SEGURIDAD ESTRICTA: Usar los IDs autorizados en la sesi�n criptogr�fica
    if (sesionPadre.estudiantesPermitidosIds && sesionPadre.estudiantesPermitidosIds.length > 0) {
      estudiantesIdsFamilia = sesionPadre.estudiantesPermitidosIds.map(Number);
    } else if (sesionPadre.estudianteAutorizadoId) {
      estudiantesIdsFamilia = [Number(sesionPadre.estudianteAutorizadoId)];
    }
  }

  const colegioId = sesionPersonal?.colegioId || sesionPadre?.colegioId || COLEGIO_DEFAULT_ID;
  const esPersonal = Boolean(sesionPersonal);
  const esSuperAdmin = sesionPersonal?.rol === "SUPER_ADMIN";
  const nombreIdentidad = esPersonal
    ? sesionPersonal?.usuario
    : sesionPadre?.tutorTitular;

  const encoder = new TextEncoder();

  // 2. Crear ReadableStream para SSE
  const stream = new ReadableStream({
    start(controller) {
      // Enviar evento de confirmaci�n de conexi�n
      const payloadConexion = {
        ok: true,
        mensaje: "Conectado al canal escolar en tiempo real",
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
          // Seguridad: Filtrado estricto por colegio
          const colegioEvento = !evento.colegioId || evento.colegioId === "default" ? COLEGIO_DEFAULT_ID : evento.colegioId;
          if (!esSuperAdmin && colegioEvento !== colegioId) {
            return; // Descartar evento de otra instituci�n
          }

          // Si es sesi�n familiar, aplicar FILTRADO PRIVADO CERO EXPOSICI�N
          if (sesionPadre) {
            if (
              evento.tipo === "ASISTENCIA_REGISTRADA" ||
              evento.tipo === "ASISTENCIA_SALIDA" ||
              evento.tipo === "SALIDA_EXCEPCIONAL_REGISTRADA"
            ) {
              const estudianteId = Number(evento.datos?.estudianteId || (evento.datos as any)?.estudiante?.id);
              if (
                !estudianteId ||
                !estudiantesIdsFamilia.includes(estudianteId)
              ) {
                return; // Estudiante ajeno: BLOQUEADO. No emitir nada por privacidad.
              }
            } else {
              // Omitir cualquier evento administrativo o del sistema para familias
              return;
            }
          }

          // Enviar formato SSE est�ndar
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

      // Heartbeat cada 15 segundos para mantener viva la conexi�n en Vercel/proxies
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Manejar desconexi�n limpia del cliente
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Ya cerrado
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
