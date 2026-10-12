import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enviarWhatsApp } from "@/services/whatsapp";
import { enviarTelegram } from "@/lib/telegram";
import {
  exigirAdminDemoOPersonal,
  exigirAdminOPersonal,
} from "@/lib/auth";
import { resolverColegio } from "@/lib/tenant";
import {
  fechaPeru,
  horaPeru,
  formatoHora12,
  formatoHora,
  obtenerLimitesDiaPeru,
  obtenerVentanaTurno,
  calcularEstadoAsistencia,
  calcularEstadoSalida,
  evaluarJornadaVigente,
} from "@/lib/timezone";
import {
  verificarModuloActivo,
  registrarAuditoriaBloqueo,
  registrarAuditoriaAutorizado,
  respuestaBloqueoSupermotor,
} from "@/lib/supermotor-guard";
import { emitEvent } from "@/lib/events/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Almacén híbrido (L1 Memoria + L2 PostgreSQL) para Idempotencia Persistente entre instancias Vercel Serverless
interface EntradaIdempotencia {
  status: number;
  body: any;
  expiraAt: number;
}
const cacheIdempotenciaGlobal = new Map<string, EntradaIdempotencia>();

async function obtenerDeCacheIdempotencia(key: string | null): Promise<EntradaIdempotencia | null> {
  if (!key) return null;

  // 1. Chequeo ultra-rápido L1 en memoria de la instancia
  const item = cacheIdempotenciaGlobal.get(key);
  if (item && Date.now() <= item.expiraAt) {
    return item;
  }

  // 2. Chequeo persistente L2 en PostgreSQL (compartido entre todas las instancias de Vercel)
  try {
    const registro = await prisma.registroIdempotencia.findUnique({
      where: { clave: key },
    });
    if (registro && new Date(registro.expiraAt).getTime() > Date.now()) {
      const entrada: EntradaIdempotencia = {
        status: registro.statusCode,
        body: registro.respuesta,
        expiraAt: new Date(registro.expiraAt).getTime(),
      };
      cacheIdempotenciaGlobal.set(key, entrada);
      return entrada;
    }
  } catch (errDb) {
    console.warn("[IDEMPOTENCIA DB] Error no crítico consultando RegistroIdempotencia:", errDb);
  }

  return null;
}

async function guardarEnCacheIdempotencia(
  key: string | null,
  status: number,
  body: any,
  estudianteId?: number | null,
  colegioId: string = "SANTA_RITA_001"
): Promise<void> {
  if (!key) return;
  const expiraAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  // L1: Guardar en memoria local
  if (cacheIdempotenciaGlobal.size > 10000) {
    const ahora = Date.now();
    for (const [k, v] of cacheIdempotenciaGlobal.entries()) {
      if (v.expiraAt < ahora) cacheIdempotenciaGlobal.delete(k);
    }
  }
  cacheIdempotenciaGlobal.set(key, {
    status,
    body,
    expiraAt: expiraAtDate.getTime(),
  });

  // L2: Persistir en PostgreSQL de forma síncrona/await para sincronización inmediata entre todas las instancias Vercel Serverless
  try {
    await prisma.registroIdempotencia.upsert({
      where: { clave: key },
      update: {
        statusCode: status,
        respuesta: body,
        expiraAt: expiraAtDate,
      },
      create: {
        clave: key,
        tipoOperacion: "ASISTENCIA",
        estudianteId: estudianteId || null,
        colegioId,
        statusCode: status,
        respuesta: body,
        expiraAt: expiraAtDate,
      },
    });
  } catch (errDb) {
    console.warn("[IDEMPOTENCIA DB] Error no crítico persistiendo RegistroIdempotencia:", errDb);
  }
}

export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json(
      { message: tenant.message },
      { status: tenant.status }
    );
  }

  const colegioId = tenant.context.colegioId;

  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");

    let inicioDia: Date | undefined;
    let finDia: Date | undefined;

    if (fecha) {
      const limites = obtenerLimitesDiaPeru(fecha);
      inicioDia = limites.inicioDia;
      finDia = limites.finDia;
    }

    const whereFiltro: any = {};
    if (!tenant.context.esSuperAdmin || !request.url.includes("todos=true")) {
      whereFiltro.colegioId = colegioId;
    }
    if (fecha && inicioDia && finDia) {
      whereFiltro.fecha = {
        gte: inicioDia,
        lte: finDia,
      };
    }

    const asistencias = await prisma.asistencia.findMany({
      where: whereFiltro,
      orderBy: {
        fecha: "desc",
      },
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
        turno: true,
      },
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error("Error consultando asistencias:", error);

    return NextResponse.json(
      {
        message: "No se pudieron consultar las asistencias",
      },
      { status: 500 }
    );
  }
}

async function obtenerEventoNoLectivo(turnoId: number | null) {
  const { inicioDia, finDia } = obtenerLimitesDiaPeru();

  return prisma.calendarioEscolar.findFirst({
    where: {
      estado: true,
      fechaInicio: {
        lte: finDia,
      },
      fechaFin: {
        gte: inicioDia,
      },
      OR: [
        {
          todosLosTurnos: true,
        },
        {
          todosLosTurnos: false,
          turnoId,
        },
      ],
    },
    include: {
      turno: true,
    },
  });
}

async function notificarTelegram({
  chatId,
  estudiante,
  tipo,
  hora,
  metodo,
  estado,
}: {
  chatId: string;
  estudiante: any;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
  metodo: string;
  estado: string;
}) {
  if (!chatId) return;

  const iconoEstado =
    estado === "TARDE" ? "🟠" : "🟢";

  const mensaje = `🏫 I.E. Santa Rita de Casia

${
  tipo === "ENTRADA"
    ? "✅ ENTRADA REGISTRADA"
    : "👋 SALIDA REGISTRADA"
}

👩‍🎓 Estudiante:
${estudiante.nombres} ${estudiante.apellidos}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

⏰ Turno:
${estudiante.turno?.nombre || "Sin turno"} (${
    estudiante.turno?.horaEntrada || "--:--"
  } - ${estudiante.turno?.horaSalida || "--:--"})

${iconoEstado} Estado:
${estado}

🕒 Hora:
${hora}

📌 Método:
${metodo}

📷 Evidencia fotográfica disponible en el Portal Web de Padres.`;

  await enviarTelegram(chatId, mensaje);
}

export async function POST(request: Request) {
  const acceso = await exigirAdminOPersonal(request);

  if (!acceso.autorizado) {
    console.warn("[ASISTENCIA API] Acceso denegado en /api/asistencias");
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json(
      { message: tenant.message },
      { status: tenant.status }
    );
  }

  const colegioId = tenant.context.colegioId;

  // FASE 4.2 & FASE 8.7: Capa de autorización del SuperMotor por colegio
  const validacionAsistencia = await verificarModuloActivo("asistencia", colegioId);
  if (!validacionAsistencia.autorizado) {
    console.log("[ASISTENCIA API] Registro bloqueado por SuperMotor (" + colegioId + "):", validacionAsistencia.motivo);
    await registrarAuditoriaBloqueo({
      modulo: "ASISTENCIA",
      motivo: validacionAsistencia.motivo || "SUPERMOTOR_APAGADO",
      usuario: acceso.sesion.usuario,
      detalles: {
        colegioId,
        motorActivo: validacionAsistencia.estado?.motorActivo ?? false,
        asistenciaActivo: validacionAsistencia.estado?.asistenciaActivo ?? false,
      },
    });

    return respuestaBloqueoSupermotor(
      "El sistema de asistencia se encuentra temporalmente desactivado."
    );
  }

  // FASE 4.7: Registrar auditoría de asistencia autorizada
  await registrarAuditoriaAutorizado({
    modulo: "ASISTENCIA",
    usuario: acceso.sesion.usuario,
  });

  try {
    const body = await request.json();

    const idempotencyKey =
      (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) ||
      request.headers.get("x-idempotency-key") ||
      null;
    const clientTimestamp =
      typeof body.clientTimestamp === "number" ? body.clientTimestamp : null;
    const intencionOperativa: "AUTO" | "ENTRADA" | "SALIDA" =
      body.intencionOperativa === "ENTRADA" || body.intencionOperativa === "SALIDA"
        ? body.intencionOperativa
        : "AUTO";

    if (idempotencyKey) {
      const respCache = await obtenerDeCacheIdempotencia(idempotencyKey);
      if (respCache) {
        console.log(`[ASISTENCIA IDEMPOTENCIA] Retornando respuesta en caché para clave: ${idempotencyKey}`);
        return NextResponse.json(respCache.body, { status: respCache.status });
      }
    }

    const dni =
      typeof body.dni === "string"
        ? body.dni.trim()
        : "";

    const codigo =
      typeof body.codigo === "string"
        ? body.codigo.trim()
        : "";

    const metodo =
      typeof body.metodo === "string"
        ? body.metodo.trim()
        : "DNI";

    const fotoUrl =
      typeof body.fotoUrl === "string"
        ? body.fotoUrl.trim()
        : typeof body.foto === "string"
        ? body.foto.trim()
        : "";

    if (!dni && !codigo) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debe ingresar el DNI o código del estudiante",
        },
        { status: 400 }
      );
    }

    // FASE 4.3 & Sanitización estricta de evidencia fotográfica:
    // Solo permitir URL real de Vercel Blob o null.
    // Si contiene URLs falsas/locales (sistema-asistencia.local, evidencia-pendiente, placeholder), reemplazar con null.
    let fotoUrlFinal: string | null = null;
    if (fotoUrl && typeof fotoUrl === "string") {
      const u = fotoUrl.trim();
      const esFicticia =
        u.includes("sistema-asistencia.local") ||
        u.includes("evidencia-pendiente") ||
        u.includes("placeholder") ||
        u.includes("localhost");

      if (!esFicticia && (u.startsWith("https://") || u.startsWith("http://"))) {
        fotoUrlFinal = u;
      }
    }

    const validacionFotos = await verificarModuloActivo("fotos", colegioId);
    if (validacionFotos.autorizado && !fotoUrlFinal) {
      console.warn("[ASISTENCIA API] Fotos activo pero evidencia fotográfica no disponible o falló subida. La foto nunca bloquea la asistencia; se registrará con fotoUrl = null.");
    }

    const condicionesBusqueda: Array<
      { dni: string } | { codigo: string }
    > = [];

    if (dni) {
      condicionesBusqueda.push({ dni });
      // Si se envió un valor en dni pero no tiene formato de 8 dígitos y no se envió codigo,
      // también probar buscar por codigo para mayor tolerancia a entradas del usuario
      if (!codigo && !/^\d{8}$/.test(dni)) {
        condicionesBusqueda.push({ codigo: dni });
      }
    }

    if (codigo) {
      condicionesBusqueda.push({ codigo });
      // Si el código enviado parece un DNI (8 dígitos numéricos) y no se especificó dni por separado,
      // también buscar por dni para máxima compatibilidad con carnets y códigos QR
      if (/^\d{8}$/.test(codigo) && !dni) {
        condicionesBusqueda.push({ dni: codigo });
      }
    }

    const [estudiante, configuracionCanales] =
      await Promise.all([
        prisma.estudiante.findFirst({
          where: {
            colegioId,
            OR: condicionesBusqueda,
          },
          include: {
            turno: true,
          },
        }),
        prisma.configuracion.findFirst({
          where: { colegioId },
          select: {
            canalWhatsAppActivo: true,
            canalTelegramActivo: true,
          },
        }),
      ]);

    if (!estudiante) {
      return NextResponse.json(
        {
          ok: false,
          message: "Estudiante no encontrado",
        },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          ok: false,
          message: "Estudiante inactivo",
        },
        { status: 400 }
      );
    }

    if (!estudiante.turno) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante no tiene turno asignado. Asigne un turno antes de registrar asistencia.",
        },
        { status: 400 }
      );
    }

    // Regla: Si un turno está INACTIVO, no debe permitir marcar asistencia
    if (!estudiante.turno.estado) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `El turno ${estudiante.turno.nombre} no está habilitado actualmente`,
          turnoInactivo: true,
          turno: {
            id: estudiante.turno.id,
            nombre: estudiante.turno.nombre,
          },
        },
        {
          status: 409,
        }
      );
    }

    const eventoNoLectivo =
      await obtenerEventoNoLectivo(
        estudiante.turnoId
      );

    if (eventoNoLectivo) {
      const alcance =
        eventoNoLectivo.todosLosTurnos
          ? "todos los turnos"
          : `el turno ${
              eventoNoLectivo.turno?.nombre ||
              estudiante.turno.nombre
            }`;

      return NextResponse.json(
        {
          ok: false,
          message: `Hoy no se registra asistencia porque es un día no lectivo: ${eventoNoLectivo.descripcion}. Aplica para ${alcance}.`,
          diaNoLectivo: true,
          evento: {
            id: eventoNoLectivo.id,
            tipo: eventoNoLectivo.tipo,
            descripcion: eventoNoLectivo.descripcion,
          },
        },
        { status: 409 }
      );
    }

    const ahora = new Date();
    const horaActual12 = formatoHora12(ahora);

    const ventanaTurno =
      obtenerVentanaTurno({
        horaEntrada: estudiante.turno.horaEntrada,
        horaSalida: estudiante.turno.horaSalida,
        margenEntradaAnticipadaMinutos: estudiante.turno.margenEntradaAnticipadaMinutos,
        margenSalidaAnticipadaMinutos: estudiante.turno.margenSalidaAnticipadaMinutos ?? 0,
        margenSalidaMinutos: estudiante.turno.margenSalidaMinutos,
        ahora,
      });

    // En turnos nocturnos que cruzan la medianoche, fechaBase atribuye correctamente
    // la jornada al día de inicio escolar, garantizando que la salida post-medianoche
    // cierre el mismo registro de entrada de anoche sin crear duplicados ni desfasar la fecha.
    const fechaDia = ventanaTurno.fechaBase;

    // 1. Búsqueda por clave de unicidad (estudianteId + fechaDia + turnoId)
    let asistencia =
      await prisma.asistencia.findFirst({
        where: {
          estudianteId: estudiante.id,
          fechaDia,
          turnoId: estudiante.turno.id,
        },
        orderBy: {
          id: "desc",
        },
      });

    // 2. Fallback por ventana de turno si fechaDia no estuviera asignada
    if (!asistencia) {
      asistencia =
        await prisma.asistencia.findFirst({
          where: {
            estudianteId: estudiante.id,
            fecha: {
              gte: ventanaTurno.inicioPermitido,
              lte: ventanaTurno.finPermitido,
            },
          },
          orderBy: {
            id: "desc",
          },
        });
    }

    /*
     * CASO A: REGISTRO DE ENTRADA (Primera marcación del día)
     */
    if (!asistencia) {
      // Si la intención declarada era SALIDA pero no tiene registro previo de entrada
      if (intencionOperativa === "SALIDA") {
        return NextResponse.json(
          {
            ok: false,
            codigoResultado: "SIN_AUTORIZACION",
            tipo: "SALIDA",
            message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} no registra entrada el día de hoy. No puede marcar salida sin haber ingresado.`,
            estudiante,
          },
          { status: 400 }
        );
      }

      if (ahora < ventanaTurno.inicioPermitido) {
        return NextResponse.json(
          {
            ok: false,
            codigoResultado: "FUERA_DE_HORARIO",
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_ANTICIPADA",
            tipo: "ENTRADA",
            message:
              `Todavía no está habilitado el ingreso para el turno ${estudiante.turno.nombre}. ` +
              `Puede marcar desde las ${formatoHora12(ventanaTurno.inicioPermitido)}. ` +
              `Hora actual: ${horaActual12}.`,
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
            estudiante,
          },
          { status: 409 }
        );
      }

      if (ahora > ventanaTurno.horaSalidaTurno) {
        return NextResponse.json(
          {
            ok: false,
            codigoResultado: "FUERA_DE_HORARIO",
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_FINALIZADA",
            tipo: "ENTRADA",
            message:
              `El horario de entrada del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La entrada se permite hasta las ${formatoHora12(ventanaTurno.horaSalidaTurno)}. ` +
              `Hora actual: ${horaActual12}.`,
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
            estudiante,
          },
          { status: 409 }
        );
      }

      const estadoAsistencia = calcularEstadoAsistencia(
        ahora,
        ventanaTurno.horaEntradaTurno,
        estudiante.turno.margenAlertaMinutos
      );

      console.log("[ASISTENCIA API] Creando entrada para estudiante:", estudiante.id, "Turno:", estudiante.turno.nombre, "Estado:", estadoAsistencia);

      let nuevaAsistencia;
      try {
        nuevaAsistencia = await prisma.asistencia.create({
          data: {
            colegioId: estudiante.colegioId || colegioId,
            estudianteId: estudiante.id,
            fecha: ahora,
            fechaDia,
            turnoId: estudiante.turno.id,
            horaEntrada: ahora,
            metodo,
            estado: estadoAsistencia,
            estadoJornada: "ABIERTA",
            estadoSalida: "PENDIENTE",
            fotoUrl: fotoUrlFinal,
            fotoEntrada: fotoUrlFinal,
          },
        });

        try {
          await prisma.evidenciaFotografica.upsert({
            where: {
              asistenciaId_tipo: {
                asistenciaId: nuevaAsistencia.id,
                tipo: "ENTRADA",
              },
            },
            update: {
              url: fotoUrlFinal || undefined,
              estado: fotoUrlFinal ? "COMPLETADA" : undefined,
            },
            create: {
              asistenciaId: nuevaAsistencia.id,
              estudianteId: estudiante.id,
              colegioId: estudiante.colegioId || colegioId,
              tipo: "ENTRADA",
              estado: fotoUrlFinal ? "COMPLETADA" : "PENDIENTE",
              url: fotoUrlFinal || null,
              intentos: fotoUrlFinal ? 1 : 0,
            },
          });
        } catch (errEv) {
          console.warn("[ASISTENCIA API] Error no crítico creando EvidenciaFotografica (ENTRADA):", errEv);
        }
      } catch (errDb: any) {
        if (errDb instanceof Prisma.PrismaClientKnownRequestError && errDb.code === "P2002") {
          console.warn("[ASISTENCIA API] Detección de marcación concurrente P2002 para estudiante:", estudiante.id);
          const yaExiste = await prisma.asistencia.findFirst({
            where: {
              estudianteId: estudiante.id,
              fechaDia,
              turnoId: estudiante.turno.id,
            },
          });
          const horaReg = formatoHora12(yaExiste?.horaEntrada || yaExiste?.fecha || ahora);
          return NextResponse.json(
            {
              ok: true,
              yaRegistrado: true,
              tipo: "ENTRADA",
              estado: yaExiste?.estado || estadoAsistencia,
              estadoJornada: yaExiste?.estadoJornada || "ABIERTA",
              estadoSalida: yaExiste?.estadoSalida || "PENDIENTE",
              estudiante,
              asistencia: yaExiste,
              message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró asistencia hoy a las ${horaReg}`,
            },
            { status: 409 }
          );
        }
        throw errDb;
      }

      console.log("[ASISTENCIA API] Registro de entrada exitoso id:", nuevaAsistencia.id);

      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "ENTRADA",
          hora: horaActual12,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          turno: `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`,
          estado: estadoAsistencia,
          metodo,
        }).catch((error) => {
          console.error("Error no crítico enviando WhatsApp:", error);
        });
      }

      if (configuracionCanales?.canalTelegramActivo && estudiante.telegramChatId) {
        notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "ENTRADA",
          hora: horaActual12,
          metodo,
          estado: estadoAsistencia,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
      }

      emitEvent("ASISTENCIA_REGISTRADA", {
        colegioId: estudiante.colegioId || colegioId,
        asistenciaId: nuevaAsistencia.id,
        estudianteId: estudiante.id,
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          dni: estudiante.dni,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          tutor: estudiante.nombreTutor,
          turno: estudiante.turno?.nombre,
        },
        hora: horaActual12,
        hora24: horaPeru(ahora),
        fecha: fechaDia,
        metodo,
        estado: estadoAsistencia,
        tipo: "ENTRADA",
        fotoUrl: fotoUrlFinal ? `/api/portal-padres/foto?asistenciaId=${nuevaAsistencia.id}&tipo=ENTRADA` : null,
      }, estudiante.colegioId || colegioId);

      const respEntradaExitosa = {
        ok: true,
        codigoResultado: "ENTRADA_REGISTRADA",
        tipo: "ENTRADA",
        estado: estadoAsistencia,
        estadoJornada: "ABIERTA",
        estadoSalida: "PENDIENTE",
        hora: horaActual12,
        horaFormateada: horaActual12,
        estudiante,
        asistencia: nuevaAsistencia,
        message: "Entrada registrada correctamente",
      };
      await guardarEnCacheIdempotencia(idempotencyKey, 200, respEntradaExitosa, estudiante.id, estudiante.colegioId || colegioId);
      return NextResponse.json(respEntradaExitosa);
    }

    /*
     * CASO C: REGISTRO DE ENTRADA SOBRE INASISTENCIA PREVIA (FALTA por cron/sistema con horaEntrada nula)
     */
    if (asistencia.horaEntrada === null) {
      if (ahora < ventanaTurno.inicioPermitido) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `Todavía no está habilitado el ingreso para el turno ${estudiante.turno.nombre}. ` +
              `Puede marcar desde las ${formatoHora12(ventanaTurno.inicioPermitido)}. ` +
              `Hora actual: ${horaActual12}.`,
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_ANTICIPADA",
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      if (ahora > ventanaTurno.horaSalidaTurno) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `El horario de entrada del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La entrada se permite hasta las ${formatoHora12(ventanaTurno.horaSalidaTurno)}. ` +
              `Hora actual: ${horaActual12}.`,
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_FINALIZADA",
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      const estadoAsistencia = calcularEstadoAsistencia(
        ahora,
        ventanaTurno.horaEntradaTurno,
        estudiante.turno.margenAlertaMinutos
      );

      console.log("[ASISTENCIA API] Regularizando inasistencia previa para estudiante:", estudiante.id, "Turno:", estudiante.turno.nombre, "Estado:", estadoAsistencia);

      const resultadoUpdateFalta = await prisma.asistencia.updateMany({
        where: {
          id: asistencia.id,
          horaEntrada: null, // Guardia atómica de concurrencia
        },
        data: {
          horaEntrada: ahora,
          estado: estadoAsistencia,
          estadoJornada: "ABIERTA",
          estadoSalida: "PENDIENTE",
          metodo,
          fotoUrl: fotoUrlFinal,
          fotoEntrada: fotoUrlFinal,
        },
      });

      if (resultadoUpdateFalta.count === 0) {
        const yaExiste = await prisma.asistencia.findUnique({
          where: { id: asistencia.id },
        });
        const horaReg = formatoHora12(yaExiste?.horaEntrada || yaExiste?.fecha || ahora);
        return NextResponse.json(
          {
            ok: true,
            yaRegistrado: true,
            tipo: "ENTRADA",
            estado: yaExiste?.estado || estadoAsistencia,
            estadoJornada: yaExiste?.estadoJornada || "ABIERTA",
            estadoSalida: yaExiste?.estadoSalida || "PENDIENTE",
            estudiante,
            asistencia: yaExiste,
            message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró asistencia hoy a las ${horaReg}`,
          },
          { status: 409 }
        );
      }

      const asistenciaActualizada = await prisma.asistencia.findUnique({
        where: { id: asistencia.id },
      });

      try {
        await prisma.evidenciaFotografica.upsert({
          where: {
            asistenciaId_tipo: {
              asistenciaId: asistencia.id,
              tipo: "ENTRADA",
            },
          },
          update: {
            url: fotoUrlFinal || undefined,
            estado: fotoUrlFinal ? "COMPLETADA" : undefined,
          },
          create: {
            asistenciaId: asistencia.id,
            estudianteId: estudiante.id,
            colegioId: estudiante.colegioId || colegioId,
            tipo: "ENTRADA",
            estado: fotoUrlFinal ? "COMPLETADA" : "PENDIENTE",
            url: fotoUrlFinal || null,
            intentos: fotoUrlFinal ? 1 : 0,
          },
        });
      } catch (errEv) {
        console.warn("[ASISTENCIA API] Error no crítico creando EvidenciaFotografica (ENTRADA):", errEv);
      }

      console.log("[ASISTENCIA API] Inasistencia regularizada con éxito id:", asistencia.id);

      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "ENTRADA",
          hora: horaActual12,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          turno: `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`,
          estado: estadoAsistencia,
          metodo,
        }).catch((error) => {
          console.error("Error no crítico enviando WhatsApp:", error);
        });
      }

      if (configuracionCanales?.canalTelegramActivo && estudiante.telegramChatId) {
        notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "ENTRADA",
          hora: horaActual12,
          metodo,
          estado: estadoAsistencia,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
      }

      emitEvent("ASISTENCIA_REGISTRADA", {
        colegioId: estudiante.colegioId || colegioId,
        asistenciaId: asistencia.id,
        estudianteId: estudiante.id,
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          dni: estudiante.dni,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          tutor: estudiante.nombreTutor,
          turno: estudiante.turno?.nombre,
        },
        hora: horaActual12,
        hora24: horaPeru(ahora),
        fecha: fechaDia,
        metodo,
        estado: estadoAsistencia,
        tipo: "ENTRADA",
        fotoUrl: fotoUrlFinal ? `/api/portal-padres/foto?asistenciaId=${asistencia.id}&tipo=ENTRADA` : null,
      }, estudiante.colegioId || colegioId);

      const respCasoCExitosa = {
        ok: true,
        codigoResultado: "ENTRADA_REGISTRADA",
        tipo: "ENTRADA",
        estado: estadoAsistencia,
        estadoJornada: "ABIERTA",
        estadoSalida: "PENDIENTE",
        hora: horaActual12,
        horaFormateada: horaActual12,
        estudiante,
        asistencia: asistenciaActualizada,
        message: "Entrada registrada correctamente (Actualizada inasistencia previa)",
      };
      await guardarEnCacheIdempotencia(idempotencyKey, 200, respCasoCExitosa, estudiante.id, estudiante.colegioId || colegioId);
      return NextResponse.json(respCasoCExitosa);
    }

    /*
     * CASO B: EL ESTUDIANTE YA TIENE REGISTRADA ENTRADA (JORNADA ABIERTA)
     */
    if (!asistencia.horaSalida) {
      const horaEntradaReg = formatoHora12(asistencia.horaEntrada || asistencia.fecha);
      const tiempoDesdeEntradaMs = asistencia.horaEntrada
        ? ahora.getTime() - new Date(asistencia.horaEntrada).getTime()
        : 0;

      // SUB-CASO B.1: INTENCIÓN DECLARADA DE ENTRADA O MODO ENTRADA O ESCANEO REPETIDO
      // Un escaneo repetido en modo entrada, o cualquier intento donde intencionOperativa !== "SALIDA",
      // NUNCA debe transformarse en salida, ni alterar horaSalida.
      const esIntencionExplicitaSalida = intencionOperativa === "SALIDA";
      const dentroPeriodoEntradaAuto = !esIntencionExplicitaSalida && (
        intencionOperativa === "ENTRADA" ||
        tiempoDesdeEntradaMs < 60 * 60 * 1000 ||
        ahora < ventanaTurno.inicioSalidaPermitido
      );

      if (dentroPeriodoEntradaAuto || !esIntencionExplicitaSalida) {
        const respYaEntro = {
          ok: true,
          codigoResultado: "ASISTENCIA_YA_REGISTRADA",
          yaRegistrado: true,
          tipo: "ENTRADA",
          estado: asistencia.estado,
          estadoJornada: asistencia.estadoJornada || "ABIERTA",
          estadoSalida: asistencia.estadoSalida || "PENDIENTE",
          hora: horaEntradaReg,
          horaFormateada: horaEntradaReg,
          estudiante,
          asistencia,
          message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró su entrada hoy a las ${horaEntradaReg}. La jornada escolar permanece ABIERTA.`,
          turno: {
            nombre: estudiante.turno.nombre,
            horaSalida: estudiante.turno.horaSalida,
          },
        };
        await guardarEnCacheIdempotencia(idempotencyKey, 200, respYaEntro, estudiante.id, estudiante.colegioId || colegioId);
        return NextResponse.json(respYaEntro, { status: 200 });
      }

      // SUB-CASO B.2: INTENCIÓN EXPLÍCITA DE SALIDA (MODO SALIDA)
      // 2. Cálculo del estado de salida contemplando la ventana anticipada, oficial y margen posterior
      const {
        estadoSalida,
        esBloqueadoAntesVentana,
        esAnticipada,
        esFueraHorario,
        inicioVentanaSalida,
        limiteSalida,
      } = calcularEstadoSalida({
        ahora,
        horaSalidaTurno: ventanaTurno.horaSalidaTurno,
        margenSalidaAnticipadaMinutos: estudiante.turno.margenSalidaAnticipadaMinutos ?? 0,
        margenSalidaMinutos: estudiante.turno.margenSalidaMinutos,
      });

      // Si la hora actual es anterior al inicio de la ventana de salida, bloquear salida prematura
      if (esBloqueadoAntesVentana) {
        const horaInicioSalida = formatoHora12(inicioVentanaSalida);
        const horaSalidaOficial = formatoHora12(ventanaTurno.horaSalidaTurno);
        const horaEntradaPrevia = formatoHora12(asistencia.horaEntrada || asistencia.fecha);
        return NextResponse.json(
          {
            ok: false,
            codigoResultado: "FUERA_DE_HORARIO",
            salidaAnticipada: true,
            tipoRestriccion: "SALIDA_ANTICIPADA",
            tipo: "SALIDA",
            estado: asistencia.estado,
            estadoJornada: "ABIERTA",
            estadoSalida: "PENDIENTE",
            hora: horaEntradaPrevia,
            horaFormateada: horaEntradaPrevia,
            estudiante,
            asistencia,
            message:
              `La salida todavía no está habilitada para el turno ${estudiante.turno.nombre}. ` +
              `Puede marcar salida desde las ${horaInicioSalida} (Salida oficial: ${horaSalidaOficial}). ` +
              `Hora actual: ${horaActual12}. La jornada escolar permanece ABIERTA.`,
            turno: {
              nombre: estudiante.turno.nombre,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      const mensajeSalida = esFueraHorario
        ? `Salida registrada con advertencia: fuera del horario permitido (Hora límite: ${formatoHora12(limiteSalida)})`
        : esAnticipada
        ? "Salida anticipada autorizada registrada"
        : "Salida registrada correctamente";

      // 3. Actualización atómica en base de datos con guardia de concurrencia
      const resultadoUpdate = await prisma.asistencia.updateMany({
        where: {
          id: asistencia.id,
          horaSalida: null, // Evita colisiones de 2 salidas simultáneas
        },
        data: {
          horaSalida: ahora,
          estadoJornada: "CERRADA",
          estadoSalida,
          fotoSalida: fotoUrlFinal,
        },
      });

      // Si otro proceso concurrente ya actualizó la salida primero
      if (resultadoUpdate.count === 0) {
        const yaActualizada = await prisma.asistencia.findUnique({
          where: { id: asistencia.id },
        });
        const horaSalidaReg = formatoHora12(yaActualizada?.horaSalida || ahora);
        return NextResponse.json(
          {
            ok: true,
            yaRegistrado: true,
            tipo: "SALIDA",
            estadoJornada: "CERRADA",
            estadoSalida: yaActualizada?.estadoSalida || estadoSalida,
            estudiante,
            asistencia: yaActualizada,
            message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró su salida a las ${horaSalidaReg}`,
          },
          { status: 409 }
        );
      }

      // Recuperar el registro actualizado completo
      const asistenciaCerrada = await prisma.asistencia.findUnique({
        where: { id: asistencia.id },
      });

      console.log("[ASISTENCIA API] Registro de salida exitoso id:", asistencia.id, "Estado salida:", estadoSalida);

      // FASE 4.2.1: Registrar estado inicial en EvidenciaFotografica (PENDIENTE / COMPLETADA) para SALIDA
      try {
        await prisma.evidenciaFotografica.upsert({
          where: {
            asistenciaId_tipo: {
              asistenciaId: asistencia.id,
              tipo: "SALIDA",
            },
          },
          update: {},
          create: {
            asistenciaId: asistencia.id,
            estudianteId: estudiante.id,
            colegioId: estudiante.colegioId || colegioId,
            tipo: "SALIDA",
            estado: fotoUrlFinal ? "COMPLETADA" : "PENDIENTE",
            url: fotoUrlFinal || null,
            intentos: fotoUrlFinal ? 1 : 0,
          },
        });
      } catch (errEv) {
        console.warn("[ASISTENCIA API] Error no crítico creando EvidenciaFotografica (SALIDA):", errEv);
      }

      // Notificaciones externas en segundo plano (NO bloqueantes)
      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "SALIDA",
          hora: horaActual12,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          turno: `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`,
          estado: estadoSalida,
          metodo,
        }).catch((error) => {
          console.error("Error no crítico enviando WhatsApp:", error);
        });
      }

      if (configuracionCanales?.canalTelegramActivo && estudiante.telegramChatId) {
        notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "SALIDA",
          hora: horaActual12,
          metodo,
          estado: estadoSalida,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
      }

      // FASE 6.7 & FASE 8.4: Emitir evento en tiempo real ASISTENCIA_SALIDA por colegio
      emitEvent("ASISTENCIA_SALIDA", {
        colegioId: estudiante.colegioId || colegioId,
        asistenciaId: asistencia.id,
        estudianteId: estudiante.id,
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          dni: estudiante.dni,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          tutor: estudiante.nombreTutor,
          turno: estudiante.turno?.nombre,
        },
        hora: horaActual12,
        hora24: horaPeru(ahora),
        fecha: fechaDia,
        metodo,
        estadoSalida,
        tipo: "SALIDA",
        fotoUrl: fotoUrlFinal ? `/api/portal-padres/foto?asistenciaId=${asistencia.id}&tipo=SALIDA` : null,
      }, estudiante.colegioId || colegioId);

      const respSalidaExitosa = {
        ok: true,
        codigoResultado: "SALIDA_REGISTRADA",
        tipo: "SALIDA",
        estado: asistencia.estado,
        estadoJornada: "CERRADA",
        estadoSalida,
        hora: horaActual12,
        horaFormateada: horaActual12,
        estudiante,
        asistencia: asistenciaCerrada,
        message: mensajeSalida,
      };
      await guardarEnCacheIdempotencia(idempotencyKey, 200, respSalidaExitosa, estudiante.id, estudiante.colegioId || colegioId);
      return NextResponse.json(respSalidaExitosa);
    }

    /*
     * CASO C: YA REGISTRÓ ENTRADA Y SALIDA HOY (JORNADA CERRADA)
     */
    const horaEntradaReg = formatoHora12(asistencia.horaEntrada || asistencia.fecha);
    const horaSalidaReg = formatoHora12(asistencia.horaSalida);
    return NextResponse.json(
      {
        ok: true,
        yaRegistrado: true,
        tipo: "SALIDA",
        jornadaCerrada: true,
        estadoJornada: "CERRADA",
        estadoSalida: asistencia.estadoSalida || "REGISTRADA",
        message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya completó su jornada escolar hoy (Entrada: ${horaEntradaReg}, Salida: ${horaSalidaReg})`,
        asistencia,
        estudiante,
      },
      { status: 409 }
    );
  } catch (error) {
    console.error(
      "Error registrando asistencia:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Error al registrar asistencia",
      },
      { status: 500 }
    );
  }
}