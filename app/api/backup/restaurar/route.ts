import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMANO_MAXIMO = 20 * 1024 * 1024;

type RegistroBackup = Record<string, unknown>;

type BackupSistema = {
  sistema?: string;
  version?: string;

  estudiantes: RegistroBackup[];
  turnos: RegistroBackup[];
  asistencias: RegistroBackup[];

  configuracion?: RegistroBackup[];
  auditoria?: RegistroBackup[];
  alertasAsistencia?: RegistroBackup[];
  analisisIA?: RegistroBackup[];
  riesgosIA?: RegistroBackup[];
  calendarioEscolar?: RegistroBackup[];
  historialReportes?: RegistroBackup[];
};

function esLista(valor: unknown): valor is RegistroBackup[] {
  return Array.isArray(valor);
}

function convertirFecha(valor: unknown) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const fecha = new Date(String(valor));

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(
      `Se encontró una fecha inválida: ${String(valor)}`
    );
  }

  return fecha;
}

function normalizarFechas(
  registros: RegistroBackup[],
  campos: string[]
) {
  return registros.map((registro) => {
    const resultado: RegistroBackup = {
      ...registro,
    };

    campos.forEach((campo) => {
      if (
        Object.prototype.hasOwnProperty.call(
          registro,
          campo
        )
      ) {
        resultado[campo] = convertirFecha(
          registro[campo]
        );
      }
    });

    return resultado;
  });
}

async function reiniciarSecuencia(
  tabla: string
) {
  /*
   * Después de insertar IDs del backup, PostgreSQL debe
   * actualizar su secuencia para que los nuevos registros
   * no intenten reutilizar IDs existentes.
   */
  await prisma.$queryRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"${tabla}"', 'id'),
      COALESCE(MAX(id), 1),
      MAX(id) IS NOT NULL
    )
    FROM "${tabla}";
  `);
}

export async function POST(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const formData = await request.formData();
    const archivo = formData.get("archivo");

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Debe seleccionar un archivo de backup",
        },
        {
          status: 400,
        }
      );
    }

    if (archivo.size <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo de backup está vacío",
        },
        {
          status: 400,
        }
      );
    }

    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo de backup supera los 20 MB",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !archivo.name
        .toLowerCase()
        .endsWith(".json")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo debe tener extensión .json",
        },
        {
          status: 400,
        }
      );
    }

    const texto = await archivo.text();

    let backup: BackupSistema;

    try {
      backup = JSON.parse(
        texto
      ) as BackupSistema;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo no contiene un JSON válido",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !esLista(backup.turnos) ||
      !esLista(backup.estudiantes) ||
      !esLista(backup.asistencias)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El archivo no parece ser un backup válido del sistema",
        },
        {
          status: 400,
        }
      );
    }

    const turnos = normalizarFechas(
      backup.turnos,
      ["createdAt"]
    );

    const estudiantes = normalizarFechas(
      backup.estudiantes,
      ["createdAt"]
    );

    const asistencias = normalizarFechas(
      backup.asistencias,
      [
        "fecha",
        "horaEntrada",
        "horaSalida",
      ]
    );

    const configuracion = normalizarFechas(
      esLista(backup.configuracion)
        ? backup.configuracion
        : [],
      [
        "createdAt",
        "ultimoReporteTelegramAt",
        "ultimoReporteDirectorAt",
        "ultimoReportePadresAt",
      ]
    );

    const auditoria = normalizarFechas(
      esLista(backup.auditoria)
        ? backup.auditoria
        : [],
      ["createdAt"]
    );

    const alertasAsistencia = normalizarFechas(
      esLista(backup.alertasAsistencia)
        ? backup.alertasAsistencia
        : [],
      ["createdAt"]
    );

    const analisisIA = normalizarFechas(
      esLista(backup.analisisIA)
        ? backup.analisisIA
        : [],
      ["createdAt"]
    );

    const riesgosIA = normalizarFechas(
      esLista(backup.riesgosIA)
        ? backup.riesgosIA
        : [],
      ["createdAt", "updatedAt"]
    );

    const calendarioEscolar = normalizarFechas(
      esLista(backup.calendarioEscolar)
        ? backup.calendarioEscolar
        : [],
      [
        "fechaInicio",
        "fechaFin",
        "createdAt",
      ]
    );

    const historialReportes = normalizarFechas(
      esLista(backup.historialReportes)
        ? backup.historialReportes
        : [],
      [
        "fechaInicio",
        "fechaFin",
        "createdAt",
      ]
    );

    /*
     * Todas las operaciones se realizan dentro de una
     * transacción. Si alguna falla, Prisma revierte todo.
     */
    await prisma.$transaction(
      async (tx) => {
        /*
         * Primero se eliminan las tablas dependientes.
         */
        await tx.historialReporteAutomatico.deleteMany();
        await tx.alertaAsistencia.deleteMany();
        await tx.riesgoEstudianteIA.deleteMany();
        await tx.asistencia.deleteMany();
        await tx.calendarioEscolar.deleteMany();

        await tx.estudiante.deleteMany();
        await tx.turno.deleteMany();

        await tx.configuracion.deleteMany();
        await tx.auditoria.deleteMany();
        await tx.analisisIA.deleteMany();

        /*
         * Después se restauran las tablas principales
         * antes de sus relaciones dependientes.
         */
        if (turnos.length > 0) {
          await tx.turno.createMany({
            data: turnos as never[],
          });
        }

        if (estudiantes.length > 0) {
          await tx.estudiante.createMany({
            data: estudiantes as never[],
          });
        }

        if (asistencias.length > 0) {
          await tx.asistencia.createMany({
            data: asistencias as never[],
          });
        }

        if (configuracion.length > 0) {
          await tx.configuracion.createMany({
            data: configuracion as never[],
          });
        }

        if (analisisIA.length > 0) {
          await tx.analisisIA.createMany({
            data: analisisIA as never[],
          });
        }

        if (riesgosIA.length > 0) {
          await tx.riesgoEstudianteIA.createMany({
            data: riesgosIA as never[],
          });
        }

        if (calendarioEscolar.length > 0) {
          await tx.calendarioEscolar.createMany({
            data: calendarioEscolar as never[],
          });
        }

        if (alertasAsistencia.length > 0) {
          await tx.alertaAsistencia.createMany({
            data: alertasAsistencia as never[],
          });
        }

        if (historialReportes.length > 0) {
          await tx.historialReporteAutomatico.createMany(
            {
              data: historialReportes as never[],
            }
          );
        }

        if (auditoria.length > 0) {
          await tx.auditoria.createMany({
            data: auditoria as never[],
          });
        }

        await tx.auditoria.create({
          data: {
            usuario:
              acceso.sesion.usuario,
            rol: acceso.sesion.rol,
            accion: "RESTAURAR",
            modulo: "Backup",
            detalle:
              `Restauró el backup ${archivo.name}`,
          },
        });
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      }
    );

    /*
     * Se actualizan las secuencias después de recuperar
     * registros con sus IDs originales.
     */
    const tablas = [
      "Turno",
      "Estudiante",
      "Asistencia",
      "Configuracion",
      "Auditoria",
      "AlertaAsistencia",
      "AnalisisIA",
      "RiesgoEstudianteIA",
      "CalendarioEscolar",
      "HistorialReporteAutomatico",
    ];

    for (const tabla of tablas) {
      await reiniciarSecuencia(tabla);
    }

    return NextResponse.json({
      ok: true,
      message:
        "Backup restaurado correctamente",
      resumen: {
        turnos: turnos.length,
        estudiantes: estudiantes.length,
        asistencias: asistencias.length,
        configuraciones:
          configuracion.length,
        auditorias: auditoria.length,
        alertas:
          alertasAsistencia.length,
        analisisIA: analisisIA.length,
        riesgosIA: riesgosIA.length,
        calendario:
          calendarioEscolar.length,
        historialReportes:
          historialReportes.length,
      },
    });
  } catch (error) {
    console.error(
      "Error restaurando backup:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al restaurar el backup",
      },
      {
        status: 500,
      }
    );
  }
}