/**
 * services/fotos/rotacionFotosService.ts
 * Servicio Institucional de Políticas de Fotografías Rotativas y Conservación.
 *
 * Directrices:
 * 1. Máximo habitual de 1 foto activa de ENTRADA y 1 de SALIDA por estudiante y turno.
 * 2. Patrón de almacenamiento seguro: Subir -> Verificar -> Actualizar Referencia -> Programar Limpieza Anterior.
 * 3. Protección contra subidas tardías: Una foto de ayer recibida con retraso NO reemplaza el puntero activo de hoy.
 * 4. Protección estricta de evidencias sujetas a incidentes, retiros excepcionales o conservación judicial/administrativa.
 * 5. Cola de limpieza en estado CONSERVADO_POLITICA hasta aprobación formal institucional. Cero borrados en producción.
 */

import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export interface OpcionesRotacionEvidencia {
  colegioId: string;
  estudianteId: number;
  turnoId: number | null;
  asistenciaId: number;
  fechaDia: string;
  tipo: "ENTRADA" | "SALIDA";
  url: string;
  evidenciaId?: number | null;
  ahora?: Date;
}

export interface ResultadoRotacion {
  ok: boolean;
  activa: boolean;
  reemplazoActivo: boolean;
  motivo?: string;
  punteroId?: number;
  evidenciaAnteriorRotada?: boolean;
  evidenciaAnteriorProtegida?: boolean;
}

/**
 * Procesa la rotación segura de evidencia fotográfica para un estudiante y turno.
 * Mantiene exactamente 1 puntero activo de ENTRADA y 1 de SALIDA.
 */
export async function procesarRotacionEvidencia(
  opciones: OpcionesRotacionEvidencia
): Promise<ResultadoRotacion> {
  const {
    colegioId,
    estudianteId,
    turnoId,
    asistenciaId,
    fechaDia,
    tipo,
    url,
    evidenciaId,
  } = opciones;

  const ahora = opciones.ahora || new Date();

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return {
      ok: false,
      activa: false,
      reemplazoActivo: false,
      motivo: "URL_INVALIDA",
    };
  }

  // 1. Consultar puntero activo previo para (estudianteId, turnoId, tipo)
  const punteroExistente = await prisma.fotoActivaEstudiante.findFirst({
    where: {
      estudianteId,
      turnoId,
      tipo,
    },
  });

  // 2. Control de subida tardía: Si el puntero existente corresponde a una fecha posterior a esta evidencia,
  // significa que esta foto pertenece al pasado (ej. ayer) y llegó tarde. No debe sobrescribir la foto activa de hoy.
  if (punteroExistente && punteroExistente.fechaDia > fechaDia) {
    console.warn(
      `[ROTACION FOTOS] Subida tardía detectada para estudiante #${estudianteId} (${tipo}). ` +
      `Fecha recibida: ${fechaDia}, Puntero activo actual: ${punteroExistente.fechaDia}. No se reemplaza foto activa.`
    );

    // Marcar esta evidencia como no activa por ser tardía
    if (evidenciaId) {
      await prisma.evidenciaFotografica.update({
        where: { id: evidenciaId },
        data: {
          esActiva: false,
          rotadaAt: ahora,
        },
      });
    }

    return {
      ok: true,
      activa: false,
      reemplazoActivo: false,
      motivo: "SUBIDA_TARDIA_IGNORADA",
      punteroId: punteroExistente.id,
    };
  }

  let evidenciaAnteriorRotada = false;
  let evidenciaAnteriorProtegida = false;

  // 3. Si existe foto previa y es de una asistencia anterior, evaluar si está protegida antes de encolarla
  if (punteroExistente && punteroExistente.asistenciaId !== asistenciaId) {
    const asistAnterior = await prisma.asistencia.findUnique({
      where: { id: punteroExistente.asistenciaId },
      include: { salidaExcepcional: true },
    });

    const esProtegida = Boolean(
      asistAnterior?.fotoProtegida ||
      (tipo === "ENTRADA" ? asistAnterior?.fotoEntradaProtegida : asistAnterior?.fotoSalidaProtegida) ||
      asistAnterior?.salidaExcepcional != null
    );

    if (esProtegida) {
      evidenciaAnteriorProtegida = true;
      console.log(
        `[ROTACION FOTOS] Evidencia anterior de Asistencia #${punteroExistente.asistenciaId} está PROTEGIDA. Se conserva.`
      );

      // Si existe registro en EvidenciaFotografica previa, marcarlo como protegida
      if (punteroExistente.evidenciaId) {
        await prisma.evidenciaFotografica.update({
          where: { id: punteroExistente.evidenciaId },
          data: {
            esProtegida: true,
            esActiva: false,
            rotadaAt: ahora,
          },
        }).catch(() => null);
      }
    } else {
      evidenciaAnteriorRotada = true;

      // Marcar evidencia anterior como rotada e inactiva
      if (punteroExistente.evidenciaId) {
        await prisma.evidenciaFotografica.update({
          where: { id: punteroExistente.evidenciaId },
          data: {
            esActiva: false,
            rotadaAt: ahora,
          },
        }).catch(() => null);
      }

      // Encolar URL anterior para política de almacenamiento (conservada hasta aprobación)
      await prisma.colaLimpiezaBlob.create({
        data: {
          colegioId,
          evidenciaId: punteroExistente.evidenciaId,
          url: punteroExistente.url,
          tipo,
          estudianteId,
          asistenciaId: punteroExistente.asistenciaId,
          motivo: "ROTACION_HABITUAL",
          estado: "CONSERVADO_POLITICA",
        },
      });
    }
  }

  // 4. Actualizar o crear puntero activo (FotoActivaEstudiante)
  let punteroActualizado: any;
  if (punteroExistente) {
    punteroActualizado = await prisma.fotoActivaEstudiante.update({
      where: { id: punteroExistente.id },
      data: {
        asistenciaId,
        fechaDia,
        evidenciaId: evidenciaId || null,
        url,
        updatedAt: ahora,
      },
    });
  } else {
    punteroActualizado = await prisma.fotoActivaEstudiante.create({
      data: {
        colegioId,
        estudianteId,
        turnoId: turnoId ?? undefined,
        asistenciaId,
        fechaDia,
        tipo,
        evidenciaId: evidenciaId || null,
        url,
      },
    });
  }

  // 5. Confirmar que la evidencia fotográfica actual quede marcada como activa
  if (evidenciaId) {
    await prisma.evidenciaFotografica.update({
      where: { id: evidenciaId },
      data: {
        esActiva: true,
        rotadaAt: null,
        eliminadaBlobAt: null,
      },
    });
  }

  return {
    ok: true,
    activa: true,
    reemplazoActivo: true,
    punteroId: punteroActualizado.id,
    evidenciaAnteriorRotada,
    evidenciaAnteriorProtegida,
  };
}

/**
 * Marca una asistencia y sus fotografías asociadas como PROTEGIDAS de rotación y purga.
 * Utilizado para incidentes, salidas excepcionales y retiros autorizados.
 */
export async function protegerEvidenciaAsistencia(
  asistenciaId: number,
  motivo: string = "SALIDA_EXCEPCIONAL"
): Promise<{ ok: boolean; evidenciasProtegidas: number }> {
  // 1. Proteger registro de asistencia
  await prisma.asistencia.update({
    where: { id: asistenciaId },
    data: {
      fotoProtegida: true,
      fotoEntradaProtegida: true,
      fotoSalidaProtegida: true,
    },
  });

  // 2. Proteger todas las evidencias fotográficas asociadas
  const evidencias = await prisma.evidenciaFotografica.updateMany({
    where: { asistenciaId },
    data: {
      esProtegida: true,
    },
  });

  // 3. Cancelar cualquier elemento pendiente en cola de limpieza para esta asistencia
  await prisma.colaLimpiezaBlob.updateMany({
    where: {
      asistenciaId,
      estado: { in: ["PENDIENTE", "CONSERVADO_POLITICA"] },
    },
    data: {
      estado: "CONSERVADO_POLITICA",
      ultimoError: `Protegido por motivo: ${motivo}`,
    },
  });

  return {
    ok: true,
    evidenciasProtegidas: evidencias.count,
  };
}

/**
 * Ejecuta el procesamiento de la cola de limpieza de Blobs.
 * Salvaguarda Estricta: Si process.env.POLITICA_PURGA_APROBADA !== "SI_CONFIRMADO",
 * la purga física NUNCA se ejecuta y permanece en estado CONSERVADO_POLITICA.
 */
export async function procesarColaLimpiezaBlob(opciones?: {
  limite?: number;
  simulacion?: boolean;
}): Promise<{
  procesados: number;
  eliminados: number;
  conservados: number;
  errores: number;
  politicaAprobada: boolean;
}> {
  const limite = opciones?.limite || 50;
  const simulacion = Boolean(opciones?.simulacion);
  const politicaAprobada = process.env.POLITICA_PURGA_APROBADA === "SI_CONFIRMADO";

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // Si la institución no ha aprobado formalmente la política, o estamos en modo simulación
  if (!politicaAprobada || simulacion) {
    const totalEnCola = await prisma.colaLimpiezaBlob.count({
      where: { estado: { in: ["PENDIENTE", "CONSERVADO_POLITICA"] } },
    });

    console.log(
      `[LIMPIEZA BLOB] Política formal de purga no aprobada (o modo simulación). ` +
      `${totalEnCola} fotografías rotadas en cola permanecen conservadas institucionalmente.`
    );

    return {
      procesados: 0,
      eliminados: 0,
      conservados: totalEnCola,
      errores: 0,
      politicaAprobada: false,
    };
  }

  // Si la política fue aprobada y se autoriza purga en el entorno de pruebas
  const pendientes = await prisma.colaLimpiezaBlob.findMany({
    where: {
      estado: "PENDIENTE",
      intentos: { lt: 3 },
    },
    take: limite,
  });

  let eliminados = 0;
  let errores = 0;

  for (const item of pendientes) {
    try {
      if (token && item.url.includes("blob.vercel-storage.com")) {
        await del(item.url, { token });
      }

      await prisma.colaLimpiezaBlob.update({
        where: { id: item.id },
        data: {
          estado: "ELIMINADO",
          ejecutadoAt: new Date(),
        },
      });

      if (item.evidenciaId) {
        await prisma.evidenciaFotografica.update({
          where: { id: item.evidenciaId },
          data: {
            eliminadaBlobAt: new Date(),
          },
        }).catch(() => null);
      }

      eliminados++;
    } catch (err: any) {
      errores++;
      await prisma.colaLimpiezaBlob.update({
        where: { id: item.id },
        data: {
          intentos: { increment: 1 },
          estado: item.intentos >= 2 ? "ERROR" : "PENDIENTE",
          ultimoError: err?.message || "Error desconocido al eliminar blob",
        },
      });
    }
  }

  return {
    procesados: pendientes.length,
    eliminados,
    conservados: 0,
    errores,
    politicaAprobada: true,
  };
}
