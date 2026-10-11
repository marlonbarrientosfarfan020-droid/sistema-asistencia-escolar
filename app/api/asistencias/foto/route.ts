import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { exigirAdminOPersonal } from "@/lib/auth";
import { verificarModuloActivo } from "@/lib/supermotor-guard";
import { emitEvent } from "@/lib/events/eventBus";
import { procesarRotacionEvidencia } from "@/services/fotos/rotacionFotosService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const MAX_INTENTOS_AUTOMATICOS = 3;

export async function POST(request: Request) {
  console.log("[FOTO API] solicitud recibida");

  const acceso = await exigirAdminOPersonal(request);
  if (!acceso.autorizado) {
    console.warn("[FOTO API] Acceso denegado en /api/asistencias/foto");
    return acceso.respuesta;
  }

  // FASE 4.3: Validar fotosActivo en el SuperMotor
  const validacionFotos = await verificarModuloActivo("fotos");
  if (!validacionFotos.autorizado) {
    console.log("[FOTO API] Almacenamiento omitido: fotosActivo=false en SuperMotor");
    return NextResponse.json(
      {
        ok: false,
        activo: false,
        omitido: true,
        fotoUrl: null,
        message: "Captura de evidencia fotográfica desactivada en el SuperMotor.",
      },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (errForm: any) {
    return NextResponse.json(
      { ok: false, message: "Error parseando datos del formulario: " + errForm?.message },
      { status: 400 }
    );
  }

  const archivo = formData.get("foto");
  const asistenciaIdRaw = formData.get("asistenciaId");
  const tipoParam = formData.get("tipo")?.toString()?.toUpperCase() === "SALIDA" ? "SALIDA" : "ENTRADA";
  const asistenciaId = asistenciaIdRaw ? Number(asistenciaIdRaw) : null;

  // Si no se proveyó asistenciaId: asistenciaExistente.id, retornar error o fallback controlado
  let asistenciaExistente: any = null;
  let evidenciaExistente: any = null;
  let proximoIntento = 1;
  let evidenciaId: number | null = null;

  if (asistenciaId && Number.isInteger(asistenciaId) && asistenciaId > 0) {
    asistenciaExistente = await prisma.asistencia.findUnique({
      where: { id: asistenciaId },
      include: { estudiante: true },
    });

    if (!asistenciaExistente) {
      return NextResponse.json(
        { ok: false, message: `Asistencia #${asistenciaId} no encontrada` },
        { status: 404 }
      );
    }

    if (asistenciaExistente.colegioId !== "SANTA_RITA_001") {
      return NextResponse.json(
        { ok: false, message: "La asistencia no pertenece a la institución educativa autorizada" },
        { status: 403 }
      );
    }

    // Consultar evidencia fotográfica existente para esta asistencia y tipo
    evidenciaExistente = await prisma.evidenciaFotografica.findUnique({
      where: {
        asistenciaId_tipo: {
          asistenciaId: asistenciaExistente.id,
          tipo: tipoParam,
        },
      },
    });

    // REGLA FASE 4.2.1: Si ya está COMPLETADA, no duplicar ni sobreescribir
    if (evidenciaExistente?.estado === "COMPLETADA" && evidenciaExistente.url) {
      console.log(`[FOTO API] Evidencia ya COMPLETADA para Asistencia #${asistenciaId} (${tipoParam}). Retornando URL.`);
      return NextResponse.json({
        ok: true,
        completada: true,
        message: "La evidencia fotográfica ya se encuentra completada",
        fotoUrl: evidenciaExistente.url,
        asistenciaId,
        estado: "COMPLETADA",
        tipo: tipoParam,
      });
    }

    // REGLA FASE 4.2.1: Límite de 3 intentos automáticos
    const intentosActuales = evidenciaExistente?.intentos || 0;
    if (intentosActuales >= MAX_INTENTOS_AUTOMATICOS && evidenciaExistente?.estado === "ERROR_FINAL") {
      console.warn(`[FOTO API] Asistencia #${asistenciaId} ya alcanzó el límite máximo de ${MAX_INTENTOS_AUTOMATICOS} intentos.`);
      return NextResponse.json(
        {
          ok: false,
          limiteAlcanzado: true,
          estado: "ERROR_FINAL",
          message: `Límite máximo de ${MAX_INTENTOS_AUTOMATICOS} intentos automáticos alcanzado para esta evidencia.`,
          asistenciaId,
          tipo: tipoParam,
        },
        { status: 400 }
      );
    }

    proximoIntento = intentosActuales + 1;

    // Actualizar estado a SUBIENDO e incrementar intentos
    try {
      const evSubiendo = await prisma.evidenciaFotografica.upsert({
        where: {
          asistenciaId_tipo: {
            asistenciaId,
            tipo: tipoParam,
          },
        },
        update: {
          estado: "SUBIENDO",
          intentos: proximoIntento,
          ultimoIntento: new Date(),
        },
        create: {
          asistenciaId,
          estudianteId: asistenciaExistente.estudianteId,
          colegioId: asistenciaExistente.colegioId,
          tipo: tipoParam,
          estado: "SUBIENDO",
          intentos: 1,
          ultimoIntento: new Date(),
        },
      });
      evidenciaId = evSubiendo.id;
    } catch (errUpsert) {
      console.error("[FOTO API] Error marcando Evidencia SUBIENDO:", errUpsert);
    }
  }

  // Validación de archivo fotográfico
  if (!(archivo instanceof File)) {
    const msg = "No se recibió la fotografía";
    console.warn(`[FOTO API] ${msg}`);
    await registrarFalloEvidencia(evidenciaId, asistenciaId, asistenciaExistente, tipoParam, proximoIntento, msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  if (archivo.size <= 0) {
    const msg = "La fotografía está vacía";
    console.warn(`[FOTO API] ${msg}`);
    await registrarFalloEvidencia(evidenciaId, asistenciaId, asistenciaExistente, tipoParam, proximoIntento, msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    const msg = `Formato no permitido: ${archivo.type || "desconocido"}`;
    console.warn(`[FOTO API] ${msg}`);
    await registrarFalloEvidencia(evidenciaId, asistenciaId, asistenciaExistente, tipoParam, proximoIntento, msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  if (archivo.size > TAMANO_MAXIMO) {
    const msg = "La fotografía supera los 5 MB";
    console.warn(`[FOTO API] ${msg}`);
    await registrarFalloEvidencia(evidenciaId, asistenciaId, asistenciaExistente, tipoParam, proximoIntento, msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  // Token de Vercel Blob
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    const msg = "Falta BLOB_READ_WRITE_TOKEN en las variables de entorno";
    console.error(`[FOTO API] ${msg}`);
    await registrarFalloEvidencia(evidenciaId, asistenciaId, asistenciaExistente, tipoParam, proximoIntento, msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }

  try {
    const extension =
      archivo.type === "image/png"
        ? "png"
        : archivo.type === "image/webp"
        ? "webp"
        : "jpg";

    const nombreArchivo = `asistencias/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[FOTO API] iniciando upload Blob:", nombreArchivo);

    const blob = await put(nombreArchivo, buffer, {
      access: "public",
      token,
      addRandomSuffix: false,
      contentType: archivo.type || "image/jpeg",
    });

    if (!blob?.url || (!blob.url.startsWith("https://") && !blob.url.startsWith("http://"))) {
      throw new Error("No se obtuvo URL válida de Vercel Blob");
    }

    console.log("[FOTO API] upload exitoso URL:", blob.url);

    // Actualizar EvidenciaFotografica a COMPLETADA
    if (evidenciaId) {
      try {
        await prisma.evidenciaFotografica.update({
          where: { id: evidenciaId },
          data: {
            estado: "COMPLETADA",
            url: blob.url,
            tamanoBytes: archivo.size,
            mimeType: archivo.type,
            errorDetalle: null,
            ultimoIntento: new Date(),
          },
        });
      } catch (errEvComp) {
        console.error("[FOTO API] Error actualizando EvidenciaFotografica a COMPLETADA:", errEvComp);
      }
    }

    // Actualizar Asistencia retrocompatiblemente
    if (asistenciaId) {
      try {
        await prisma.asistencia.update({
          where: { id: asistenciaId },
          data: {
            fotoUrl: blob.url,
            ...(tipoParam === "SALIDA" ? { fotoSalida: blob.url } : { fotoEntrada: blob.url }),
          },
        });
      } catch (errAsist) {
        console.error("[FOTO API] Error actualizando foto en Asistencia:", errAsist);
      }
    }

    // FOTOGRAFÍAS ROTATIVAS: Actualizar puntero activo y gestionar política de almacenamiento
    if (asistenciaExistente && blob.url) {
      try {
        await procesarRotacionEvidencia({
          colegioId: asistenciaExistente.colegioId,
          estudianteId: asistenciaExistente.estudianteId,
          turnoId: asistenciaExistente.turnoId,
          asistenciaId: asistenciaExistente.id,
          fechaDia: asistenciaExistente.fechaDia,
          tipo: tipoParam,
          url: blob.url,
          evidenciaId,
        });
      } catch (errRotacion) {
        console.error("[FOTO API] Error en política de rotación de fotografías:", errRotacion);
      }
    }

    // Emitir evento en tiempo real independiente para observabilidad (SIN modificar contadores de asistencia)
    if (asistenciaExistente) {
      emitEvent(
        "EVIDENCIA_FOTOGRAFICA_ACTUALIZADA",
        {
          asistenciaId,
          estudianteId: asistenciaExistente.estudianteId,
          tipo: tipoParam,
          estado: "COMPLETADA",
          fotoUrl: blob.url,
          intentos: proximoIntento,
        },
        asistenciaExistente.colegioId
      );
    }

    return NextResponse.json({
      ok: true,
      estado: "COMPLETADA",
      message: "Fotografía almacenada y asociada correctamente",
      fotoUrl: blob.url,
      asistenciaId: asistenciaId || undefined,
      tipo: tipoParam,
      intentos: proximoIntento,
    });
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido al almacenar fotografía";
    console.error("[FOTO API] Falla en subida Blob:", errorMsg);

    const estadoFinal = await registrarFalloEvidencia(
      evidenciaId,
      asistenciaId,
      asistenciaExistente,
      tipoParam,
      proximoIntento,
      errorMsg
    );

    return NextResponse.json(
      {
        ok: false,
        estado: estadoFinal,
        message: `No se pudo almacenar la fotografía: ${errorMsg}`,
        asistenciaId: asistenciaId || undefined,
        tipo: tipoParam,
        intentos: proximoIntento,
      },
      { status: 500 }
    );
  }
}

/**
 * Función auxiliar para registrar la falla de subida en EvidenciaFotografica y emitir evento sin tocar Asistencia
 */
async function registrarFalloEvidencia(
  evidenciaId: number | null,
  asistenciaId: number | null,
  asistenciaExistente: any,
  tipo: "ENTRADA" | "SALIDA",
  intentos: number,
  errorMsg: string
): Promise<"ERROR" | "ERROR_FINAL"> {
  const estado: "ERROR" | "ERROR_FINAL" = intentos >= MAX_INTENTOS_AUTOMATICOS ? "ERROR_FINAL" : "ERROR";

  if (evidenciaId) {
    try {
      await prisma.evidenciaFotografica.update({
        where: { id: evidenciaId },
        data: {
          estado,
          errorDetalle: errorMsg.slice(0, 500),
          ultimoIntento: new Date(),
        },
      });
    } catch (e) {
      console.error("[FOTO API] Error persistiendo estado de fallo en EvidenciaFotografica:", e);
    }
  } else if (asistenciaId && asistenciaExistente) {
    try {
      await prisma.evidenciaFotografica.upsert({
        where: {
          asistenciaId_tipo: {
            asistenciaId,
            tipo,
          },
        },
        update: {
          estado,
          intentos,
          errorDetalle: errorMsg.slice(0, 500),
          ultimoIntento: new Date(),
        },
        create: {
          asistenciaId,
          estudianteId: asistenciaExistente.estudianteId,
          colegioId: asistenciaExistente.colegioId,
          tipo,
          estado,
          intentos,
          errorDetalle: errorMsg.slice(0, 500),
          ultimoIntento: new Date(),
        },
      });
    } catch (e) {
      console.error("[FOTO API] Error creando EvidenciaFotografica con estado de fallo:", e);
    }
  }

  if (asistenciaExistente) {
    try {
      emitEvent(
        "EVIDENCIA_FOTOGRAFICA_ACTUALIZADA",
        {
          asistenciaId,
          estudianteId: asistenciaExistente.estudianteId,
          tipo,
          estado,
          error: errorMsg,
          intentos,
        },
        asistenciaExistente.colegioId
      );
    } catch (e) {
      console.warn("[FOTO API] Error emitiendo evento de fallo:", e);
    }
  }

  return estado;
}