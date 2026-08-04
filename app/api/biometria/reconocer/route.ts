import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  reconocerRostroAWS,
} from "@/lib/aws-rekognition";

import {
  exigirAdminOPersonal,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FOTO_BYTES =
  5 * 1024 * 1024;

export async function POST(
  request: Request
) {
  const acceso =
    await exigirAdminOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const formData =
      await request.formData();

    const foto =
      formData.get("foto");

    if (
      !(foto instanceof File) ||
      foto.size === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Debe capturar una fotografía",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !foto.type.startsWith("image/")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo enviado no es una imagen",
        },
        {
          status: 400,
        }
      );
    }

    if (
      foto.size >
      MAX_FOTO_BYTES
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fotografía no puede superar los 5 MB",
        },
        {
          status: 400,
        }
      );
    }

    const arrayBuffer =
      await foto.arrayBuffer();

    const coincidenciaAWS =
      await reconocerRostroAWS({
        imagen:
          new Uint8Array(arrayBuffer),
      });

    if (!coincidenciaAWS) {
      return NextResponse.json(
        {
          ok: false,
          reconocido: false,
          message:
            "No se encontró ningún estudiante que coincida con el rostro.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Primero buscamos por FaceId.
     * Esta es la relación más segura entre AWS y Neon.
     */
    const rostro =
      await prisma.rostroFacial.findUnique({
        where: {
          faceId:
            coincidenciaAWS.faceId,
        },

        include: {
          biometria: {
            include: {
              estudiante: {
                include: {
                  turno: true,
                },
              },
            },
          },
        },
      });

    /*
     * Si el FaceId todavía no está relacionado,
     * intentamos buscar mediante ExternalImageId.
     */
    const biometriaAlternativa =
      !rostro &&
      coincidenciaAWS.externalImageId
        ? await prisma.biometriaFacial.findUnique({
            where: {
              externalImageId:
                coincidenciaAWS.externalImageId,
            },

            include: {
              estudiante: {
                include: {
                  turno: true,
                },
              },
            },
          })
        : null;

    const biometria =
      rostro?.biometria ||
      biometriaAlternativa;

    if (!biometria) {
      return NextResponse.json(
        {
          ok: false,
          reconocido: false,

          message:
            "AWS reconoció el rostro, pero no está relacionado con ningún estudiante en Neon.",

          diagnostico: {
            faceId:
              coincidenciaAWS.faceId,

            externalImageId:
              coincidenciaAWS.externalImageId,

            similitud:
              coincidenciaAWS.similitud,
          },
        },
        {
          status: 404,
        }
      );
    }

    if (!biometria.estado) {
      return NextResponse.json(
        {
          ok: false,
          reconocido: false,
          message:
            "La biometría facial de este estudiante está desactivada.",
        },
        {
          status: 400,
        }
      );
    }

    const estudiante =
      biometria.estudiante;

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          ok: false,
          reconocido: false,
          message:
            "El estudiante reconocido está inactivo.",
        },
        {
          status: 400,
        }
      );
    }

    if (!estudiante.turno) {
      return NextResponse.json(
        {
          ok: false,
          reconocido: false,
          message:
            "El estudiante reconocido no tiene turno asignado.",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.auditoria.create({
      data: {
        usuario:
          acceso.sesion.usuario,

        rol:
          acceso.sesion.rol,

        accion:
          "RECONOCER_ROSTRO",

        modulo:
          "BIOMETRIA_FACIAL",

        detalle:
          `Estudiante reconocido: ${estudiante.nombres} ${estudiante.apellidos}. Similitud: ${coincidenciaAWS.similitud.toFixed(
            2
          )}%.`,
      },
    });

    return NextResponse.json({
      ok: true,
      reconocido: true,

      message:
        "Estudiante reconocido correctamente",

      coincidencia: {
        similitud:
          coincidenciaAWS.similitud,

        confianzaDeteccion:
          coincidenciaAWS
            .confianzaDeteccion,

        faceId:
          coincidenciaAWS.faceId,
      },

      estudiante: {
        id:
          estudiante.id,

        codigo:
          estudiante.codigo,

        dni:
          estudiante.dni,

        nombres:
          estudiante.nombres,

        apellidos:
          estudiante.apellidos,

        grado:
          estudiante.grado,

        seccion:
          estudiante.seccion,

        turno: {
          id:
            estudiante.turno.id,

          nombre:
            estudiante.turno.nombre,

          horaEntrada:
            estudiante.turno
              .horaEntrada,

          horaSalida:
            estudiante.turno
              .horaSalida,
        },
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error reconociendo rostro:",
      error
    );

    const nombreError =
      error instanceof Error
        ? error.name
        : "";

    let mensaje =
      error instanceof Error
        ? error.message
        : "No se pudo reconocer el rostro";

    if (
      nombreError ===
      "InvalidParameterException"
    ) {
      mensaje =
        "AWS no detectó un rostro válido. Mire de frente, use buena iluminación y asegúrese de que aparezca una sola persona.";
    }

    if (
      nombreError ===
      "ImageTooLargeException"
    ) {
      mensaje =
        "La fotografía es demasiado grande para AWS Rekognition.";
    }

    if (
      nombreError ===
      "ResourceNotFoundException"
    ) {
      mensaje =
        "La colección facial de AWS no existe o está configurada en otra región.";
    }

    return NextResponse.json(
      {
        ok: false,
        reconocido: false,
        message: mensaje,
      },
      {
        status: 500,
      }
    );
  }
}