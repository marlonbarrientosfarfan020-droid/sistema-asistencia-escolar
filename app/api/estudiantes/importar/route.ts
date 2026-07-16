import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminODirectivo } from "@/lib/auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMANO_MAXIMO = 5 * 1024 * 1024;

type FilaExcel = Record<string, unknown>;

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

export async function POST(request: Request) {
  const acceso = await exigirAdminODirectivo();

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
          message: "Debe seleccionar un archivo Excel",
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
          message: "El archivo está vacío",
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
          message: "El archivo no puede superar los 5 MB",
        },
        {
          status: 400,
        }
      );
    }

    const nombreArchivo = archivo.name.toLowerCase();

    if (
      !nombreArchivo.endsWith(".xlsx") &&
      !nombreArchivo.endsWith(".xls")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Solo se permiten archivos Excel .xlsx o .xls",
        },
        {
          status: 400,
        }
      );
    }

    const bytes = await archivo.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const libro = XLSX.read(buffer, {
      type: "buffer",
    });

    const nombreHoja = libro.SheetNames[0];

    if (!nombreHoja) {
      return NextResponse.json(
        {
          ok: false,
          message: "El archivo Excel no contiene hojas",
        },
        {
          status: 400,
        }
      );
    }

    const hoja = libro.Sheets[nombreHoja];

    const filas = XLSX.utils.sheet_to_json<FilaExcel>(
      hoja,
      {
        defval: "",
      }
    );

    if (filas.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "El archivo Excel no contiene registros",
        },
        {
          status: 400,
        }
      );
    }

    const turnos = await prisma.turno.findMany({
      select: {
        id: true,
        nombre: true,
      },
    });

    const mapaTurnos = new Map(
      turnos.map((turno) => [
        turno.nombre.trim().toUpperCase(),
        turno.id,
      ])
    );

    let importados = 0;
    const errores: string[] = [];

    for (let indice = 0; indice < filas.length; indice++) {
      const fila = filas[indice];
      const numeroFila = indice + 2;

      const codigo = texto(fila.codigo);
      const dni = texto(fila.dni);
      const nombres = texto(fila.nombres);
      const apellidos = texto(fila.apellidos);
      const grado = texto(fila.grado);
      const seccion = texto(fila.seccion);
      const nombreTutor = texto(fila.nombreTutor);
      const whatsapp = texto(fila.whatsapp);
      const telegramChatId = texto(fila.telegramChatId);
      const turnoNombre = texto(fila.turno).toUpperCase();

      if (
        !codigo ||
        !dni ||
        !nombres ||
        !apellidos ||
        !grado ||
        !seccion ||
        !turnoNombre
      ) {
        errores.push(
          `Fila ${numeroFila}: faltan campos obligatorios`
        );
        continue;
      }

      if (!/^\d{8}$/.test(dni)) {
        errores.push(
          `Fila ${numeroFila}: el DNI debe tener 8 dígitos`
        );
        continue;
      }

      const turnoId = mapaTurnos.get(turnoNombre);

      if (!turnoId) {
        errores.push(
          `Fila ${numeroFila}: turno no encontrado (${turnoNombre})`
        );
        continue;
      }

      const existe = await prisma.estudiante.findFirst({
        where: {
          OR: [
            {
              codigo,
            },
            {
              dni,
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (existe) {
        errores.push(
          `Fila ${numeroFila}: ya existe el código ${codigo} o DNI ${dni}`
        );
        continue;
      }

      await prisma.estudiante.create({
        data: {
          codigo,
          dni,
          nombres,
          apellidos,
          grado,
          seccion,
          nombreTutor,
          whatsapp,
          telegramChatId,
          turnoId,
        },
      });

      importados++;
    }

    return NextResponse.json({
      ok: errores.length === 0,
      message:
        errores.length === 0
          ? "Importación completada correctamente"
          : "Importación completada con observaciones",
      importados,
      errores,
      totalFilas: filas.length,
      usuario: acceso.sesion.usuario,
    });
  } catch (error) {
    console.error(
      "Error importando estudiantes:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Error al importar estudiantes",
      },
      {
        status: 500,
      }
    );
  }
}