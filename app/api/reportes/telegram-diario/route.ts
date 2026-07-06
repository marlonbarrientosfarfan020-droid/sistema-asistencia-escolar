import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarArchivoTelegram } from "@/lib/telegram";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

function fechaPeru() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;
  const day = partes.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function hora(fecha: Date | null | undefined) {
  if (!fecha) return "-";

  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

async function guardarEstadoReporte(estado: string) {
  const configuracion = await prisma.configuracion.findFirst();

  if (!configuracion) return;

  await prisma.configuracion.update({
    where: { id: configuracion.id },
    data: {
      ultimoReporteTelegramAt: new Date(),
      ultimoReporteTelegramEstado: estado,
    },
  });
}

export async function GET(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const configuracion = await prisma.configuracion.findFirst();

    const chatId =
      configuracion?.telegramDirectorChatId ||
      process.env.TELEGRAM_DIRECTOR_CHAT_ID;

    if (!chatId) {
      await guardarEstadoReporte("❌ Error: falta Chat ID del director");

      return NextResponse.json(
        { message: "Falta Telegram Chat ID del director" },
        { status: 400 }
      );
    }

    const fecha = fechaPeru();

    const inicioDia = new Date(`${fecha}T00:00:00-05:00`);
    const finDia = new Date(`${fecha}T23:59:59-05:00`);

    const estudiantes = await prisma.estudiante.findMany({
      where: {
        estado: true,
        turno: {
          nombre: {
            in: ["MAÑANA", "TARDE", "NOCHE"],
          },
        },
      },
      include: {
        turno: true,
        asistencias: {
          where: {
            fecha: {
              gte: inicioDia,
              lte: finDia,
            },
          },
        },
      },
      orderBy: {
        apellidos: "asc",
      },
    });

    const datos = estudiantes.map((estudiante) => {
      const asistencia = estudiante.asistencias[0];

      return {
        Fecha: fecha,
        Turno: estudiante.turno?.nombre || "Sin turno",
        Estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        DNI: estudiante.dni,
        Grado: `${estudiante.grado} - ${estudiante.seccion}`,
        Entrada: hora(asistencia?.horaEntrada),
        Salida: hora(asistencia?.horaSalida),
        Estado: asistencia?.estado || "AUSENTE",
        Metodo: asistencia?.metodo || "-",
      };
    });

    const presentes = datos.filter((d) => d.Estado !== "AUSENTE").length;
    const ausentes = datos.filter((d) => d.Estado === "AUSENTE").length;
    const puntuales = datos.filter((d) => d.Estado === "PUNTUAL").length;
    const tardanzas = datos.filter((d) => d.Estado === "TARDE").length;

    const caption = `📊 Reporte diario de asistencias
📅 Fecha: ${fecha}
🕒 Turnos: MAÑANA, TARDE y NOCHE`;

    if (configuracion?.enviarReporteExcel ?? true) {
      const hoja = XLSX.utils.json_to_sheet(datos);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Reporte Diario");

      const excelBuffer = XLSX.write(libro, {
        type: "buffer",
        bookType: "xlsx",
      });

      await enviarArchivoTelegram(
        chatId,
        excelBuffer,
        `Reporte_Asistencia_${fecha}.xlsx`,
        caption
      );
    }

    if (configuracion?.enviarReportePdf ?? true) {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("I.E. Santa Rita de Casia", 105, 15, { align: "center" });

      doc.setFontSize(13);
      doc.text("Reporte Diario de Asistencias", 105, 24, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${fecha}`, 14, 38);
      doc.text("Turnos: MAÑANA, TARDE y NOCHE", 14, 45);
      doc.text(`Presentes: ${presentes}`, 14, 52);
      doc.text(`Ausentes: ${ausentes}`, 55, 52);
      doc.text(`Puntuales: ${puntuales}`, 95, 52);
      doc.text(`Tardanzas: ${tardanzas}`, 140, 52);

      autoTable(doc, {
        startY: 62,
        head: [
          [
            "Turno",
            "Estudiante",
            "DNI",
            "Grado",
            "Entrada",
            "Salida",
            "Estado",
          ],
        ],
        body: datos.map((d) => [
          d.Turno,
          d.Estudiante,
          d.DNI,
          d.Grado,
          d.Entrada,
          d.Salida,
          d.Estado,
        ]),
        styles: {
          fontSize: 7,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
        },
      });

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      await enviarArchivoTelegram(
        chatId,
        pdfBuffer,
        `Reporte_Asistencia_${fecha}.pdf`,
        caption
      );
    }

    await guardarEstadoReporte("✅ Enviado correctamente");

    return NextResponse.json({
      ok: true,
      message: "Reporte enviado por Telegram",
    });
  } catch (error) {
    console.error(error);

    await guardarEstadoReporte("❌ Error al enviar");

    return NextResponse.json(
      { message: "Error al enviar reporte por Telegram" },
      { status: 500 }
    );
  }
}