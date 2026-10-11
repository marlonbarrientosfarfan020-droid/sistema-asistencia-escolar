import {
  CreateCollectionCommand,
  DescribeCollectionCommand,
  IndexFacesCommand,
  ListCollectionsCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
const region =
  process.env.AWS_REGION ||
  "us-east-1";

export const COLLECTION_ID =
  process.env
    .AWS_REKOGNITION_COLLECTION_ID ||
  "santa-rita-estudiantes";

/**
 * Resuelve la colección biométrica por colegio manteniendo 100% de compatibilidad
 * con la colección predeterminada en producción (santa-rita-estudiantes).
 */
export function resolverColeccionColegio(colegioId?: string): string {
  const defaultCol = process.env.AWS_REKOGNITION_COLLECTION_ID || "santa-rita-estudiantes";
  if (!colegioId || colegioId === "SANTA_RITA_001" || colegioId === "default") {
    return defaultCol;
  }
  const cleanId = colegioId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return `colegio-${cleanId}-estudiantes`;
}

function obtenerCredenciales() {
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID;

  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId) {
    throw new Error(
      "Falta AWS_ACCESS_KEY_ID en .env"
    );
  }

  if (!secretAccessKey) {
    throw new Error(
      "Falta AWS_SECRET_ACCESS_KEY en .env"
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
}

export const rekognition =
  new RekognitionClient({
    region,
    credentials:
      obtenerCredenciales(),
  });

export async function probarConexionAWS() {
  const respuesta =
    await rekognition.send(
      new ListCollectionsCommand({
        MaxResults: 20,
      })
    );

  return respuesta.CollectionIds || [];
}

export async function asegurarColeccionFacial(colegioId?: string) {
  const targetCollection = resolverColeccionColegio(colegioId);
  try {
    await rekognition.send(
      new DescribeCollectionCommand({
        CollectionId:
          targetCollection,
      })
    );

    return {
      creada: false,
      collectionId:
        targetCollection,
    };
  } catch (error: unknown) {
    const nombreError =
      error instanceof Error
        ? error.name
        : "";

    if (
      nombreError !==
      "ResourceNotFoundException"
    ) {
      throw error;
    }
  }

  await rekognition.send(
    new CreateCollectionCommand({
      CollectionId:
        targetCollection,
    })
  );

  return {
    creada: true,
    collectionId:
      COLLECTION_ID,
  };
}

export async function registrarRostroAWS({
  estudianteId,
  imagen,
  colegioId,
}: {
  estudianteId: number;
  imagen: Uint8Array;
  colegioId?: string;
}) {
  const targetCollection = resolverColeccionColegio(colegioId);
  await asegurarColeccionFacial(colegioId);
  const externalImageId =
    `estudiante_${estudianteId}`;

  const resultado =
    await rekognition.send(
      new IndexFacesCommand({
        CollectionId:
          targetCollection,

        Image: {
          Bytes: imagen,
        },

        ExternalImageId:
          externalImageId,

        MaxFaces: 1,

        QualityFilter: "AUTO",

        DetectionAttributes: [
          "DEFAULT",
        ],
      })
    );

  const registros =
    resultado.FaceRecords || [];

  if (registros.length === 0) {
    throw new Error(
      "AWS no detectó un rostro válido. Use buena iluminación, mire de frente y asegúrese de que aparezca una sola persona."
    );
  }

  const rostro =
    registros[0];

  const faceId =
    rostro.Face?.FaceId;

  if (!faceId) {
    throw new Error(
      "AWS no devolvió el identificador del rostro"
    );
  }

  return {
    faceId,
    imageId:
      rostro.Face?.ImageId ||
      null,

    externalImageId,

    confianza:
      rostro.FaceDetail
        ?.Confidence || null,
  };
}
export async function reconocerRostroAWS({
  imagen,
  colegioId,
}: {
  imagen: Uint8Array;
  colegioId?: string;
}) {
  const targetCollection = resolverColeccionColegio(colegioId);
  await asegurarColeccionFacial(colegioId);
  const similitudMinimaTexto =
    process.env.AWS_REKOGNITION_MIN_SIMILARITY ||
    "97";

  const similitudMinima =
    Number(similitudMinimaTexto);

  const resultado =
    await rekognition.send(
      new SearchFacesByImageCommand({
        CollectionId: targetCollection,

        Image: {
          Bytes: imagen,
        },

        FaceMatchThreshold:
          Number.isFinite(similitudMinima)
            ? similitudMinima
            : 97,

        MaxFaces: 1,

        QualityFilter: "AUTO",
      })
    );

  const coincidencia =
    resultado.FaceMatches?.[0];

  if (
    !coincidencia ||
    !coincidencia.Face?.FaceId
  ) {
    return null;
  }

  return {
    faceId:
      coincidencia.Face.FaceId,

    externalImageId:
      coincidencia.Face
        .ExternalImageId || null,

    similitud:
      coincidencia.Similarity || 0,

    confianzaDeteccion:
      resultado.SearchedFaceConfidence ||
      null,
  };
}