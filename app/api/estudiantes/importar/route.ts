import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function esAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function POST(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const formData = await request.formData();
    const archivo = formData.get("archivo") as File;

    if (!archivo) {
      return NextResponse.json(
        { message: "Debe subir un archivo Excel" },
        { status: 400 }
      );
    }

    const bytes = await archivo.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const libro = XLSX.read(buffer, { type: "buffer" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas: any[] = XLSX.utils.sheet_to_json(hoja);

    let importados = 0;
    let errores: string[] = [];

    for (const fila of filas) {
      const codigo = String(fila.codigo || "").trim();
      const dni = String(fila.dni || "").trim();
      const nombres = String(fila.nombres || "").trim();
      const apellidos = String(fila.apellidos || "").trim();
      const grado = String(fila.grado || "").trim();
      const seccion = String(fila.seccion || "").trim();
      const nombreTutor = String(fila.nombreTutor || "").trim();
      const whatsapp = String(fila.whatsapp || "").trim();
      const telegramChatId = String(fila.telegramChatId || "").trim();
      const turnoNombre = String(fila.turno || "").trim().toUpperCase();

      if (!codigo || !dni || !nombres || !apellidos || !grado || !seccion || !turnoNombre) {
        errores.push(`Fila incompleta: ${JSON.stringify(fila)}`);
        continue;
      }

      const existe = await prisma.estudiante.findFirst({
        where: {
          OR: [{ codigo }, { dni }],
        },
      });

      if (existe) {
        errores.push(`Ya existe código o DNI: ${codigo} / ${dni}`);
        continue;
      }

      const turno = await prisma.turno.findFirst({
        where: {
          nombre: turnoNombre,
        },
      });

      if (!turno) {
        errores.push(`Turno no encontrado: ${turnoNombre}`);
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
          turnoId: turno.id,
        },
      });

      importados++;
    }

    return NextResponse.json({
      ok: true,
      importados,
      errores,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al importar estudiantes" },
      { status: 500 }
    );
  }
}