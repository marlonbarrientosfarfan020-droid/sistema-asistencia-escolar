import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  COLLECTION_ID,
  registrarRostroAWS,
} from "@/lib/aws-rekognition";

import {
  exigirAdminODirectivo,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FOTO_BYTES =
  5 * 1024 * 1024;

type ContextoRuta = {
  params: Promise<{
    id: string;
  }>;
};

/* =====================================================
   OBTENER ESTUDIANTE Y ESTADO DE SU BIOMETRÍA
===================================================== */

export async function GET(
  _request: Request,
  contexto: ContextoRuta
) {
  const acceso =
    await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { id } =
      await contexto.params;

    const estudianteId =
      Number(id);

    if (
      !Number.isInteger(estudianteId) ||
      estudianteId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante seleccionado no es válido",
        },
        {
          status: 400,
        }
      );
    }

    const estudiante =
      await prisma.estudiante.findUnique({
        where: {
          id: estudianteId,
        },

        include: {
          turno: true,

          biometriaFacial: {
            include: {
              rostros: {
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          },
        },
      });

    if (!estudiante) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante no existe",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      ok: true,

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

        estado:
          estudiante.estado,

        turno:
          estudiante.turno
            ? {
                id:
                  estudiante.turno.id,

                nombre:
                  estudiante.turno.nombre,
              }
            : null,

        biometriaFacial:
          estudiante.biometriaFacial
            ? {
                id:
                  estudiante
                    .biometriaFacial.id,

                estado:
                  estudiante
                    .biometriaFacial.estado,

                proveedor:
                  estudiante
                    .biometriaFacial
                    .proveedor,

                collectionId:
                  estudiante
                    .biometriaFacial
                    .collectionId,

                externalImageId:
                  estudiante
                    .biometriaFacial
                    .externalImageId,

                ultimaActualizacionAt:
                  estudiante
                    .biometriaFacial
                    .ultimaActualizacionAt,

                rostrosRegistrados:
                  estudiante
                    .biometriaFacial
                    .rostros.length,

                ultimoRostro:
                  estudiante
                    .biometriaFacial
                    .rostros[0]
                    ? {
                        faceId:
                          estudiante
                            .biometriaFacial
                            .rostros[0]
                            .faceId,

                        confianza:
                          estudiante
                            .biometriaFacial
                            .rostros[0]
                            .confianza,

                        createdAt:
                          estudiante
                            .biometriaFacial
                            .rostros[0]
                            .createdAt,
                      }
                    : null,
              }
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Error obteniendo estudiante para biometría:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo obtener el estudiante",
      },
      {
        status: 500,
      }
    );
  }
}

/* =====================================================
   REGISTRAR ROSTRO EN AWS Y GUARDARLO EN NEON
===================================================== */

export async function POST(
  request: Request,
  contexto: ContextoRuta
) {
  const acceso =
    await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { id } =
      await contexto.params;

    const estudianteId =
      Number(id);

    if (
      !Number.isInteger(estudianteId) ||
      estudianteId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante seleccionado no es válido",
        },
        {
          status: 400,
        }
      );
    }

    const estudiante =
      await prisma.estudiante.findUnique({
        where: {
          id: estudianteId,
        },

        include: {
          biometriaFacial: {
            include: {
              rostros: true,
            },
          },
        },
      });

    if (!estudiante) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante no existe",
        },
        {
          status: 404,
        }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No puede registrar el rostro de un estudiante inactivo",
        },
        {
          status: 400,
        }
      );
    }

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
      !foto.type.startsWith(
        "image/"
      )
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

    /* Registrar primero en AWS */

    const resultadoAWS =
      await registrarRostroAWS({
        estudianteId,

        imagen:
          new Uint8Array(
            arrayBuffer
          ),
      });

    /* Guardar relación en Neon */

    const biometria =
      await prisma.biometriaFacial.upsert({
        where: {
          estudianteId,
        },

        create: {
          estudianteId,

          proveedor:
            "AWS_REKOGNITION",

          collectionId:
            COLLECTION_ID,

          externalImageId:
            resultadoAWS.externalImageId,

          estado: true,

          ultimaActualizacionAt:
            new Date(),

          rostros: {
            create: {
              faceId:
                resultadoAWS.faceId,

              imageId:
                resultadoAWS.imageId,

              confianza:
                resultadoAWS.confianza,
            },
          },
        },

        update: {
          proveedor:
            "AWS_REKOGNITION",

          collectionId:
            COLLECTION_ID,

          externalImageId:
            resultadoAWS.externalImageId,

          estado: true,

          ultimaActualizacionAt:
            new Date(),

          rostros: {
            create: {
              faceId:
                resultadoAWS.faceId,

              imageId:
                resultadoAWS.imageId,

              confianza:
                resultadoAWS.confianza,
            },
          },
        },

        include: {
          rostros: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    /* Auditoría */

    await prisma.auditoria.create({
      data: {
        usuario:
          acceso.sesion.usuario,

        rol:
          acceso.sesion.rol,

        accion:
          "REGISTRAR_ROSTRO",

        modulo:
          "BIOMETRIA_FACIAL",

        detalle:
          `Rostro registrado para ${estudiante.nombres} ${estudiante.apellidos}. FaceId: ${resultadoAWS.faceId}`,
      },
    });

    return NextResponse.json({
      ok: true,

      message:
        "Rostro registrado correctamente en AWS y guardado en Neon",

      estudiante: {
        id:
          estudiante.id,

        nombres:
          estudiante.nombres,

        apellidos:
          estudiante.apellidos,
      },

      biometria: {
        id:
          biometria.id,

        faceId:
          resultadoAWS.faceId,

        imageId:
          resultadoAWS.imageId,

        externalImageId:
          resultadoAWS.externalImageId,

        confianza:
          resultadoAWS.confianza,

        estado:
          biometria.estado,

        proveedor:
          biometria.proveedor,

        collectionId:
          biometria.collectionId,

        rostrosRegistrados:
          biometria.rostros.length,

        ultimaActualizacionAt:
          biometria
            .ultimaActualizacionAt,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error registrando rostro:",
      error
    );

    const nombreError =
      error instanceof Error
        ? error.name
        : "";

    let mensaje =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el rostro";

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

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      {
        status: 500,
      }
    );
  }
}