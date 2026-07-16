import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarArchivoTelegram } from "@/lib/telegram";
import { exigirAdminODirectivo } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONA_HORARIA = "America/Lima";

type FrecuenciaReporte = "SEMANAL" | "MENSUAL";

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
  tipo: string;
  descripcion: string;
};

type FilaReporte = {
  Fecha: string;
  Turno: string;
  Estudiante: string;
  DNI: string;
  Grado: string;
  Entrada: string;
  Salida: string;
  Estado: string;
  Metodo: string;
};

function fechaPeruString(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function crearFechaPeru(
  fecha: string,
  finalDia = false
) {
  return new Date(
    `${fecha}T${
      finalDia ? "23:59:59.999" : "00:00:00"
    }-05:00`
  );
}

function crearFechaBD(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function fechaBDString(fecha: Date) {
  const anio = fecha.getUTCFullYear();

  const mes = String(
    fecha.getUTCMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    fecha.getUTCDate()
  ).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function sumarDias(
  fecha: string,
  cantidad: number
) {
  const base = new Date(
    `${fecha}T12:00:00-05:00`
  );

  base.setDate(base.getDate() + cantidad);

  return fechaPeruString(base);
}

function generarFechas(
  fechaInicio: string,
  fechaFin: string
) {
  const fechas: string[] = [];

  let actual = fechaInicio;

  while (actual <= fechaFin) {
    fechas.push(actual);
    actual = sumarDias(actual, 1);
  }

  return fechas;
}

function esFinDeSemana(fecha: string) {
  const valor = new Date(
    `${fecha}T12:00:00-05:00`
  );

  const dia = valor.getDay();

  return dia === 0 || dia === 6;
}

function obtenerPeriodo(
  frecuencia: FrecuenciaReporte
) {
  const hoy = fechaPeruString(new Date());

  const fechaActual = new Date(
    `${hoy}T12:00:00-05:00`
  );

  let fechaInicio = hoy;

  if (frecuencia === "MENSUAL") {
    fechaInicio = `${hoy.slice(0, 7)}-01`;
  } else {
    const diaActual = fechaActual.getDay();

    const diasDesdeLunes =
      diaActual === 0
        ? 6
        : diaActual - 1;

    fechaActual.setDate(
      fechaActual.getDate() - diasDesdeLunes
    );

    fechaInicio =
      fechaPeruString(fechaActual);
  }

  return {
    fechaInicio,
    fechaFin: hoy,

    inicioAsistencias:
      crearFechaPeru(fechaInicio),

    finAsistencias:
      crearFechaPeru(hoy, true),

    inicioCalendario:
      crearFechaBD(fechaInicio),

    finCalendario:
      crearFechaBD(hoy),
  };
}

function formatoFecha(fecha: string) {
  const [anio, mes, dia] =
    fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

function hora(
  fecha: Date | null | undefined
) {
  if (!fecha) return "-";

  return fecha.toLocaleTimeString(
    "es-PE",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ZONA_HORARIA,
    }
  );
}

function existeEventoNoLectivo(
  fecha: string,
  turnoId: number | null,
  eventos: EventoCalendario[]
) {
  return eventos.some((evento) => {
    const inicio = fechaBDString(
      evento.fechaInicio
    );

    const fin = fechaBDString(
      evento.fechaFin
    );

    const aplicaFecha =
      fecha >= inicio &&
      fecha <= fin;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos &&
        evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function obtenerNombreFrecuencia(
  frecuencia: FrecuenciaReporte
) {
  return frecuencia === "MENSUAL"
    ? "Mensual"
    : "Semanal";
}

function obtenerNombreHoja(
  frecuencia: FrecuenciaReporte
) {
  return frecuencia === "MENSUAL"
    ? "Reporte Mensual"
    : "Reporte Semanal";
}

function nombreSeguro(valor: string) {
  return valor
    .replaceAll("/", "-")
    .replaceAll(" ", "_");
}

async function guardarEstadoReporte(
  estado: string,
  registrarFecha = true
) {
  const configuracion =
    await prisma.configuracion.findFirst();

  if (!configuracion) return;

  await prisma.configuracion.update({
    where: {
      id: configuracion.id,
    },
    data: {
      ...(registrarFecha
        ? {
            ultimoReporteTelegramAt:
              new Date(),

            ultimoReporteDirectorAt:
              new Date(),
          }
        : {}),

      ultimoReporteTelegramEstado:
        estado,
    },
  });
}

export async function GET(
  request: Request
) {
  const accesoCron =
    esCronAutorizado(request);

  if (!accesoCron) {
   const acceso = await exigirAdminODirectivo();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }
  }

  try {
    const { searchParams } = new URL(
      request.url
    );

    const frecuenciaSolicitada =
      String(
        searchParams.get("frecuencia") ||
          ""
      ).toUpperCase();

    const configuracion =
      await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No existe configuración institucional",
        },
        {
          status: 404,
        }
      );
    }

    const frecuencia: FrecuenciaReporte =
      frecuenciaSolicitada === "MENSUAL"
        ? "MENSUAL"
        : frecuenciaSolicitada === "SEMANAL"
        ? "SEMANAL"
        : configuracion.frecuenciaReporteDirector ===
          "MENSUAL"
        ? "MENSUAL"
        : "SEMANAL";

    const chatId =
      configuracion.telegramDirectorChatId ||
      process.env
        .TELEGRAM_DIRECTOR_CHAT_ID;

    if (!chatId) {
      await guardarEstadoReporte(
        "❌ Error: falta Chat ID del director",
        false
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Falta Telegram Chat ID del director",
        },
        {
          status: 400,
        }
      );
    }

    const periodo =
      obtenerPeriodo(frecuencia);

    const nombreFrecuencia =
      obtenerNombreFrecuencia(
        frecuencia
      );

    const fechasPeriodo =
      generarFechas(
        periodo.fechaInicio,
        periodo.fechaFin
      );

    const eventosCalendario =
      await prisma.calendarioEscolar.findMany(
        {
          where: {
            estado: true,

            fechaInicio: {
              lte: periodo.finCalendario,
            },

            fechaFin: {
              gte:
                periodo.inicioCalendario,
            },
          },

          select: {
            fechaInicio: true,
            fechaFin: true,
            todosLosTurnos: true,
            turnoId: true,
            tipo: true,
            descripcion: true,
          },
        }
      );

    const estudiantes =
      await prisma.estudiante.findMany({
        where: {
          estado: true,

          turno: {
            nombre: {
              in: [
                "MAÑANA",
                "TARDE",
                "NOCHE",
              ],
            },
          },
        },

        include: {
          turno: true,

          asistencias: {
            where: {
              fecha: {
                gte:
                  periodo.inicioAsistencias,

                lte:
                  periodo.finAsistencias,
              },
            },

            orderBy: {
              fecha: "asc",
            },
          },
        },

        orderBy: [
          {
            apellidos: "asc",
          },
          {
            nombres: "asc",
          },
        ],
      });

    const datos: FilaReporte[] = [];

    let diasNoLectivos = 0;

    for (const fecha of fechasPeriodo) {
      if (esFinDeSemana(fecha)) {
        continue;
      }

      const esDiaNoLectivoGeneral =
        existeEventoNoLectivo(
          fecha,
          null,
          eventosCalendario.filter(
            (evento) =>
              evento.todosLosTurnos
          )
        );

      if (esDiaNoLectivoGeneral) {
        diasNoLectivos++;
        continue;
      }

      for (const estudiante of estudiantes) {
        if (!estudiante.turno) {
          continue;
        }

        const noLectivoParaTurno =
          existeEventoNoLectivo(
            fecha,
            estudiante.turnoId,
            eventosCalendario
          );

        if (noLectivoParaTurno) {
          continue;
        }

        const asistencia =
          estudiante.asistencias.find(
            (registro) =>
              fechaPeruString(
                registro.fecha
              ) === fecha
          );

        datos.push({
          Fecha: formatoFecha(fecha),

          Turno:
            estudiante.turno.nombre,

          Estudiante:
            `${estudiante.nombres} ${estudiante.apellidos}`.trim(),

          DNI: estudiante.dni,

          Grado:
            `${estudiante.grado} - ${estudiante.seccion}`,

          Entrada:
            hora(
              asistencia?.horaEntrada
            ),

          Salida:
            hora(
              asistencia?.horaSalida
            ),

          Estado:
            asistencia?.estado ||
            "AUSENTE",

          Metodo:
            asistencia?.metodo || "-",
        });
      }
    }

    if (datos.length === 0) {
      await guardarEstadoReporte(
        `📅 No enviado: no existen días lectivos en el periodo ${nombreFrecuencia.toLowerCase()}`,
        false
      );

      return NextResponse.json({
        ok: true,
        omitido: true,

        message:
          "No existen estudiantes esperados en días lectivos dentro del periodo seleccionado",

        frecuencia,

        periodo: {
          desde:
            periodo.fechaInicio,

          hasta:
            periodo.fechaFin,
        },
      });
    }

    const presentes = datos.filter(
      (dato) =>
        dato.Estado !== "AUSENTE"
    ).length;

    const ausentes = datos.filter(
      (dato) =>
        dato.Estado === "AUSENTE"
    ).length;

    const puntuales = datos.filter(
      (dato) =>
        dato.Estado === "PUNTUAL"
    ).length;

    const tardanzas = datos.filter(
      (dato) =>
        dato.Estado === "TARDE"
    ).length;

    const sinSalida = datos.filter(
      (dato) =>
        dato.Entrada !== "-" &&
        dato.Salida === "-"
    ).length;

    const estudiantesUnicos =
      new Set(
        datos.map(
          (dato) => dato.DNI
        )
      ).size;

    const diasLectivos =
      new Set(
        datos.map(
          (dato) => dato.Fecha
        )
      ).size;

    const turnosIncluidos =
      Array.from(
        new Set(
          datos.map(
            (dato) => dato.Turno
          )
        )
      );

    const textoTurnos =
      turnosIncluidos.length > 0
        ? turnosIncluidos.join(", ")
        : "Sin turnos";

    const porcentajeAsistencia =
      datos.length > 0
        ? Math.round(
            (presentes /
              datos.length) *
              100
          )
        : 0;

    const tituloReporte =
      `Reporte ${nombreFrecuencia} de Asistencias`;

    const caption = `📊 ${tituloReporte.toUpperCase()}

🏫 ${configuracion.nombreColegio}

📅 Periodo:
${formatoFecha(
  periodo.fechaInicio
)} al ${formatoFecha(
      periodo.fechaFin
    )}

🕒 Turnos incluidos:
${textoTurnos}

👨‍🎓 Estudiantes: ${estudiantesUnicos}
📚 Días lectivos: ${diasLectivos}
✅ Asistencias: ${presentes}
❌ Ausencias: ${ausentes}
🟢 Puntuales: ${puntuales}
🟠 Tardanzas: ${tardanzas}
🔵 Sin salida: ${sinSalida}
📈 Porcentaje de asistencia: ${porcentajeAsistencia}%

🏖️ Días no lectivos generales excluidos: ${diasNoLectivos}`;

    const nombreBase =
      `Reporte_${nombreFrecuencia}_${nombreSeguro(
        periodo.fechaInicio
      )}_al_${nombreSeguro(
        periodo.fechaFin
      )}`;

    /*
     * REPORTE EXCEL
     */
    if (
      configuracion.enviarReporteExcel
    ) {
      const hoja =
        XLSX.utils.json_to_sheet(
          datos
        );

      hoja["!cols"] = [
        { wch: 13 },
        { wch: 14 },
        { wch: 32 },
        { wch: 13 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ];

      const libro =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        libro,
        hoja,
        obtenerNombreHoja(
          frecuencia
        )
      );

      const resumen = [
        {
          Concepto: "Colegio",
          Valor:
            configuracion.nombreColegio,
        },
        {
          Concepto: "Frecuencia",
          Valor: nombreFrecuencia,
        },
        {
          Concepto: "Desde",
          Valor: formatoFecha(
            periodo.fechaInicio
          ),
        },
        {
          Concepto: "Hasta",
          Valor: formatoFecha(
            periodo.fechaFin
          ),
        },
        {
          Concepto:
            "Estudiantes",
          Valor: estudiantesUnicos,
        },
        {
          Concepto:
            "Días lectivos",
          Valor: diasLectivos,
        },
        {
          Concepto:
            "Asistencias",
          Valor: presentes,
        },
        {
          Concepto:
            "Ausencias",
          Valor: ausentes,
        },
        {
          Concepto:
            "Puntuales",
          Valor: puntuales,
        },
        {
          Concepto:
            "Tardanzas",
          Valor: tardanzas,
        },
        {
          Concepto:
            "Sin salida",
          Valor: sinSalida,
        },
        {
          Concepto:
            "Porcentaje",
          Valor:
            `${porcentajeAsistencia}%`,
        },
      ];

      const hojaResumen =
        XLSX.utils.json_to_sheet(
          resumen
        );

      hojaResumen["!cols"] = [
        {
          wch: 25,
        },
        {
          wch: 35,
        },
      ];

      XLSX.utils.book_append_sheet(
        libro,
        hojaResumen,
        "Resumen"
      );

      const excelBuffer =
        XLSX.write(libro, {
          type: "buffer",
          bookType: "xlsx",
        });

      const excelEnviado =
        await enviarArchivoTelegram(
          chatId,
          excelBuffer,
          `${nombreBase}.xlsx`,
          caption
        );

      if (!excelEnviado) {
        throw new Error(
          "No se pudo enviar el reporte Excel por Telegram"
        );
      }
    }

    /*
     * REPORTE PDF
     */
    if (
      configuracion.enviarReportePdf
    ) {
      const doc = new jsPDF({
        orientation: "landscape",
      });

      doc.setFontSize(16);
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        configuracion.nombreColegio,
        148,
        14,
        {
          align: "center",
        }
      );

      doc.setFontSize(13);

      doc.text(
        tituloReporte,
        148,
        23,
        {
          align: "center",
        }
      );

      doc.setFontSize(9);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Periodo: ${formatoFecha(
          periodo.fechaInicio
        )} al ${formatoFecha(
          periodo.fechaFin
        )}`,
        14,
        35
      );

      doc.text(
        `Turnos: ${textoTurnos}`,
        14,
        42
      );

      doc.text(
        `Estudiantes: ${estudiantesUnicos}`,
        14,
        49
      );

      doc.text(
        `Días lectivos: ${diasLectivos}`,
        62,
        49
      );

      doc.text(
        `Asistencias: ${presentes}`,
        108,
        49
      );

      doc.text(
        `Ausencias: ${ausentes}`,
        154,
        49
      );

      doc.text(
        `Puntuales: ${puntuales}`,
        198,
        49
      );

      doc.text(
        `Tardanzas: ${tardanzas}`,
        238,
        49
      );

      doc.text(
        `Sin salida: ${sinSalida}`,
        14,
        56
      );

      doc.text(
        `Porcentaje de asistencia: ${porcentajeAsistencia}%`,
        62,
        56
      );

      autoTable(doc, {
        startY: 65,

        head: [
          [
            "Fecha",
            "Turno",
            "Estudiante",
            "DNI",
            "Grado",
            "Entrada",
            "Salida",
            "Estado",
            "Método",
          ],
        ],

        body: datos.map(
          (dato) => [
            dato.Fecha,
            dato.Turno,
            dato.Estudiante,
            dato.DNI,
            dato.Grado,
            dato.Entrada,
            dato.Salida,
            dato.Estado,
            dato.Metodo,
          ]
        ),

        styles: {
          fontSize: 7,
          cellPadding: 2,
        },

        headStyles: {
          fillColor: [
            15,
            23,
            42,
          ],

          textColor: 255,
        },

        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },
      });

      const pdfBuffer =
        Buffer.from(
          doc.output(
            "arraybuffer"
          )
        );

      const pdfEnviado =
        await enviarArchivoTelegram(
          chatId,
          pdfBuffer,
          `${nombreBase}.pdf`,
          caption
        );

      if (!pdfEnviado) {
        throw new Error(
          "No se pudo enviar el reporte PDF por Telegram"
        );
      }
    }

    await guardarEstadoReporte(
      `✅ Reporte ${nombreFrecuencia.toLowerCase()} enviado correctamente`
    );

    return NextResponse.json({
      ok: true,

      message:
        `Reporte ${nombreFrecuencia.toLowerCase()} enviado correctamente por Telegram`,

      frecuencia,

      periodo: {
        desde:
          periodo.fechaInicio,

        hasta:
          periodo.fechaFin,
      },

      resumen: {
        estudiantes:
          estudiantesUnicos,

        diasLectivos,

        registrosEsperados:
          datos.length,

        presentes,

        ausentes,

        puntuales,

        tardanzas,

        sinSalida,

        porcentajeAsistencia,

        turnosIncluidos,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error enviando reporte para el director:",
      error
    );

    await guardarEstadoReporte(
      "❌ Error al enviar",
      false
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error al enviar el reporte por Telegram";

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