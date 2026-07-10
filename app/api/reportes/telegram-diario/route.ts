import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarArchivoTelegram } from "@/lib/telegram";
import { exigirAdmin } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONA_HORARIA = "America/Lima";

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hora(fecha: Date | null | undefined) {
  if (!fecha) return "-";

  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  });
}

async function guardarEstadoReporte(
  estado: string,
  registrarFecha = true
) {
  const configuracion = await prisma.configuracion.findFirst();

  if (!configuracion) return;

  await prisma.configuracion.update({
    where: {
      id: configuracion.id,
    },
    data: {
      ...(registrarFecha
        ? { ultimoReporteTelegramAt: new Date() }
        : {}),
      ultimoReporteTelegramEstado: estado,
    },
  });
}

export async function GET(request: Request) {
  const accesoCron = esCronAutorizado(request);

  if (!accesoCron) {
    const acceso = await exigirAdmin();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }
  }

  try {
    const configuracion = await prisma.configuracion.findFirst();

    const chatId =
      configuracion?.telegramDirectorChatId ||
      process.env.TELEGRAM_DIRECTOR_CHAT_ID;

    if (!chatId) {
      await guardarEstadoReporte(
        "❌ Error: falta Chat ID del director"
      );

      return NextResponse.json(
        {
          message: "Falta Telegram Chat ID del director",
        },
        { status: 400 }
      );
    }

    const fecha = fechaPeru();

    const inicioDia = new Date(`${fecha}T00:00:00-05:00`);
    const finDia = new Date(`${fecha}T23:59:59.999-05:00`);

    const eventosNoLectivos =
      await prisma.calendarioEscolar.findMany({
        where: {
          estado: true,
          fechaInicio: {
            lte: finDia,
          },
          fechaFin: {
            gte: inicioDia,
          },
        },
        include: {
          turno: true,
        },
      });

    const eventoGeneral = eventosNoLectivos.find(
      (evento) => evento.todosLosTurnos
    );

    /*
     * Si hoy no hay clases para ningún turno,
     * el reporte no debe contar ausentes ni enviar archivos vacíos.
     */
    if (eventoGeneral) {
      const estado = `📅 No enviado: día no lectivo (${eventoGeneral.descripcion})`;

      await guardarEstadoReporte(estado, false);

      return NextResponse.json({
        ok: true,
        omitido: true,
        diaNoLectivo: true,
        message: `Reporte omitido porque hoy es día no lectivo: ${eventoGeneral.descripcion}`,
        evento: {
          tipo: eventoGeneral.tipo,
          descripcion: eventoGeneral.descripcion,
        },
      });
    }

    /*
     * Obtiene los turnos suspendidos específicamente hoy.
     */
    const idsTurnosNoLectivos = new Set(
      eventosNoLectivos
        .filter(
          (evento) =>
            !evento.todosLosTurnos &&
            evento.turnoId !== null
        )
        .map((evento) => evento.turnoId as number)
    );

    const estudiantes = await prisma.estudiante.findMany({
      where: {
        estado: true,
        turno: {
          nombre: {
            in: ["MAÑANA", "TARDE", "NOCHE"],
          },
        },
        /*
         * Excluye estudiantes pertenecientes a turnos suspendidos.
         */
        ...(idsTurnosNoLectivos.size > 0
          ? {
              turnoId: {
                notIn: Array.from(idsTurnosNoLectivos),
              },
            }
          : {}),
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
          orderBy: {
            fecha: "asc",
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

    const presentes = datos.filter(
      (dato) => dato.Estado !== "AUSENTE"
    ).length;

    const ausentes = datos.filter(
      (dato) => dato.Estado === "AUSENTE"
    ).length;

    const puntuales = datos.filter(
      (dato) => dato.Estado === "PUNTUAL"
    ).length;

    const tardanzas = datos.filter(
      (dato) => dato.Estado === "TARDE"
    ).length;

    const sinSalida = estudiantes.filter((estudiante) => {
      const asistencia = estudiante.asistencias[0];

      return Boolean(
        asistencia?.horaEntrada &&
          !asistencia?.horaSalida
      );
    }).length;

    const turnosIncluidos = Array.from(
      new Set(datos.map((dato) => dato.Turno))
    );

    const turnosSuspendidos = eventosNoLectivos
      .filter(
        (evento) =>
          !evento.todosLosTurnos &&
          evento.turnoId !== null
      )
      .map((evento) => ({
        turno: evento.turno?.nombre || "Turno específico",
        motivo: evento.descripcion,
      }));

    const textoTurnos =
      turnosIncluidos.length > 0
        ? turnosIncluidos.join(", ")
        : "Sin turnos lectivos";

    const caption = `📊 Reporte diario de asistencias
📅 Fecha: ${fecha}
🕒 Turnos incluidos: ${textoTurnos}
👨‍🎓 Estudiantes esperados: ${datos.length}
✅ Presentes: ${presentes}
❌ Ausentes: ${ausentes}
🟢 Puntuales: ${puntuales}
🟠 Tardanzas: ${tardanzas}
🔵 Sin salida: ${sinSalida}`;

    if (datos.length === 0) {
      await guardarEstadoReporte(
        "📅 No enviado: no existen turnos lectivos"
      );

      return NextResponse.json({
        ok: true,
        omitido: true,
        message:
          "No existen estudiantes esperados para los turnos lectivos de hoy",
        turnosSuspendidos,
      });
    }

    if (configuracion?.enviarReporteExcel ?? true) {
      const hoja = XLSX.utils.json_to_sheet(datos);

      hoja["!cols"] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 32 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ];

      const libro = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Reporte Diario"
      );

      if (turnosSuspendidos.length > 0) {
        const hojaSuspendidos =
          XLSX.utils.json_to_sheet(
            turnosSuspendidos.map((item) => ({
              Turno: item.turno,
              Motivo: item.motivo,
            }))
          );

        XLSX.utils.book_append_sheet(
          libro,
          hojaSuspendidos,
          "Turnos sin clases"
        );
      }

      const excelBuffer = XLSX.write(libro, {
        type: "buffer",
        bookType: "xlsx",
      });

      const excelEnviado = await enviarArchivoTelegram(
        chatId,
        excelBuffer,
        `Reporte_Asistencia_${fecha}.xlsx`,
        caption
      );

      if (!excelEnviado) {
        throw new Error(
          "No se pudo enviar el reporte Excel por Telegram"
        );
      }
    }

    if (configuracion?.enviarReportePdf ?? true) {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");

      doc.text(
        "I.E. Santa Rita de Casia",
        105,
        15,
        { align: "center" }
      );

      doc.setFontSize(13);

      doc.text(
        "Reporte Diario de Asistencias",
        105,
        24,
        { align: "center" }
      );

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      doc.text(`Fecha: ${fecha}`, 14, 38);
      doc.text(`Turnos incluidos: ${textoTurnos}`, 14, 45);
      doc.text(`Estudiantes esperados: ${datos.length}`, 14, 52);
      doc.text(`Presentes: ${presentes}`, 14, 59);
      doc.text(`Ausentes: ${ausentes}`, 55, 59);
      doc.text(`Puntuales: ${puntuales}`, 95, 59);
      doc.text(`Tardanzas: ${tardanzas}`, 140, 59);
      doc.text(`Sin salida: ${sinSalida}`, 14, 66);

      let inicioTabla = 76;

      if (turnosSuspendidos.length > 0) {
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");

        doc.text(
          "Turnos sin clases:",
          14,
          75
        );

        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);

        turnosSuspendidos.forEach((item, index) => {
          doc.text(
            `- ${item.turno}: ${item.motivo}`,
            18,
            82 + index * 6
          );
        });

        inicioTabla =
          92 + turnosSuspendidos.length * 6;
      }

      autoTable(doc, {
        startY: inicioTabla,
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
        body: datos.map((dato) => [
          dato.Turno,
          dato.Estudiante,
          dato.DNI,
          dato.Grado,
          dato.Entrada,
          dato.Salida,
          dato.Estado,
        ]),
        styles: {
          fontSize: 7,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
        },
      });

      const pdfBuffer = Buffer.from(
        doc.output("arraybuffer")
      );

      const pdfEnviado = await enviarArchivoTelegram(
        chatId,
        pdfBuffer,
        `Reporte_Asistencia_${fecha}.pdf`,
        caption
      );

      if (!pdfEnviado) {
        throw new Error(
          "No se pudo enviar el reporte PDF por Telegram"
        );
      }
    }

    await guardarEstadoReporte(
      "✅ Enviado correctamente"
    );

    return NextResponse.json({
      ok: true,
      message: "Reporte enviado por Telegram",
      resumen: {
        fecha,
        estudiantesEsperados: datos.length,
        presentes,
        ausentes,
        puntuales,
        tardanzas,
        sinSalida,
        turnosIncluidos,
        turnosSuspendidos,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error enviando reporte diario:",
      error
    );

    await guardarEstadoReporte(
      "❌ Error al enviar"
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error al enviar reporte por Telegram";

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      { status: 500 }
    );
  }
}