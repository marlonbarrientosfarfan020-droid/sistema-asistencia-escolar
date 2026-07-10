import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

export const runtime = "nodejs";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function obtenerUsuario(request: Request) {
  return request.headers.get("x-user-name") || "Usuario";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json(
    { message: "No autorizado" },
    { status: 401 }
  );
}

function convertirFecha(fecha: unknown) {
  const valor = String(fecha || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  const fechaConvertida = new Date(`${valor}T00:00:00.000Z`);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return null;
  }

  return fechaConvertida;
}

const TIPOS_VALIDOS = [
  "FERIADO",
  "VACACIONES",
  "SUSPENSION",
  "ACTIVIDAD_INSTITUCIONAL",
  "DIA_NO_LECTIVO",
  "OTRO",
];

/**
 * GET
 * Lista los días y periodos no lectivos.
 *
 * Opcionalmente permite filtrar:
 * /api/calendario-escolar?anio=2026
 * /api/calendario-escolar?anio=2026&mes=7
 */
export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);

    const anio = Number(searchParams.get("anio"));
    const mes = Number(searchParams.get("mes"));

    let filtroFecha = {};

    if (anio && mes >= 1 && mes <= 12) {
      const inicioMes = new Date(
        `${anio}-${String(mes).padStart(2, "0")}-01T00:00:00-05:00`
      );

      const finMes = new Date(inicioMes);
      finMes.setMonth(finMes.getMonth() + 1);
      finMes.setMilliseconds(-1);

      filtroFecha = {
        AND: [
          {
            fechaInicio: {
              lte: finMes,
            },
          },
          {
            fechaFin: {
              gte: inicioMes,
            },
          },
        ],
      };
    } else if (anio) {
      const inicioAnio = new Date(`${anio}-01-01T00:00:00-05:00`);
      const finAnio = new Date(`${anio}-12-31T23:59:59-05:00`);

      filtroFecha = {
        AND: [
          {
            fechaInicio: {
              lte: finAnio,
            },
          },
          {
            fechaFin: {
              gte: inicioAnio,
            },
          },
        ],
      };
    }

    const calendario = await prisma.calendarioEscolar.findMany({
      where: filtroFecha,
      include: {
        turno: true,
      },
      orderBy: [
        {
          fechaInicio: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    return NextResponse.json(calendario);
  } catch (error) {
    console.error("Error obteniendo calendario escolar:", error);

    return NextResponse.json(
      { message: "Error al obtener el calendario escolar" },
      { status: 500 }
    );
  }
}

/**
 * POST
 * Registra un nuevo feriado, suspensión, vacaciones o día no lectivo.
 */
export async function POST(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const fechaInicio = convertirFecha(body.fechaInicio);
    const fechaFin = convertirFecha(body.fechaFin);
    const tipo = String(body.tipo || "").trim().toUpperCase();
    const descripcion = String(body.descripcion || "").trim();

    const todosLosTurnos =
      body.todosLosTurnos === undefined
        ? true
        : Boolean(body.todosLosTurnos);

    const turnoId =
      !todosLosTurnos && body.turnoId
        ? Number(body.turnoId)
        : null;

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { message: "Las fechas de inicio y fin son obligatorias" },
        { status: 400 }
      );
    }

    if (fechaFin < fechaInicio) {
      return NextResponse.json(
        {
          message:
            "La fecha final no puede ser anterior a la fecha inicial",
        },
        { status: 400 }
      );
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { message: "El tipo de evento no es válido" },
        { status: 400 }
      );
    }

    if (!descripcion) {
      return NextResponse.json(
        { message: "La descripción es obligatoria" },
        { status: 400 }
      );
    }

    if (!todosLosTurnos && !turnoId) {
      return NextResponse.json(
        {
          message:
            "Debe seleccionar un turno cuando el evento no aplica a todos",
        },
        { status: 400 }
      );
    }

    if (turnoId) {
      const turnoExiste = await prisma.turno.findUnique({
        where: {
          id: turnoId,
        },
      });

      if (!turnoExiste) {
        return NextResponse.json(
          { message: "El turno seleccionado no existe" },
          { status: 404 }
        );
      }
    }

    const evento = await prisma.calendarioEscolar.create({
      data: {
        fechaInicio,
        fechaFin,
        tipo,
        descripcion,
        todosLosTurnos,
        turnoId,
        estado: true,
      },
      include: {
        turno: true,
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "CREAR",
      modulo: "Calendario escolar",
      detalle: `Registró ${tipo}: ${descripcion}, desde ${fechaInicio.toLocaleDateString(
        "es-PE"
      )} hasta ${fechaFin.toLocaleDateString("es-PE")}`,
    });

    return NextResponse.json(evento, { status: 201 });
  } catch (error) {
    console.error("Error creando evento escolar:", error);

    return NextResponse.json(
      { message: "Error al registrar el evento del calendario" },
      { status: 500 }
    );
  }
}

/**
 * PUT
 * Actualiza un evento del calendario escolar.
 */
export async function PUT(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const id = Number(body.id);
    const fechaInicio = convertirFecha(body.fechaInicio);
    const fechaFin = convertirFecha(body.fechaFin);
    const tipo = String(body.tipo || "").trim().toUpperCase();
    const descripcion = String(body.descripcion || "").trim();

    const todosLosTurnos =
      body.todosLosTurnos === undefined
        ? true
        : Boolean(body.todosLosTurnos);

    const turnoId =
      !todosLosTurnos && body.turnoId
        ? Number(body.turnoId)
        : null;

    if (!id) {
      return NextResponse.json(
        { message: "ID del evento requerido" },
        { status: 400 }
      );
    }

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { message: "Las fechas de inicio y fin son obligatorias" },
        { status: 400 }
      );
    }

    if (fechaFin < fechaInicio) {
      return NextResponse.json(
        {
          message:
            "La fecha final no puede ser anterior a la fecha inicial",
        },
        { status: 400 }
      );
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { message: "El tipo de evento no es válido" },
        { status: 400 }
      );
    }

    if (!descripcion) {
      return NextResponse.json(
        { message: "La descripción es obligatoria" },
        { status: 400 }
      );
    }

    if (!todosLosTurnos && !turnoId) {
      return NextResponse.json(
        {
          message:
            "Debe seleccionar un turno cuando el evento no aplica a todos",
        },
        { status: 400 }
      );
    }

    const eventoExistente =
      await prisma.calendarioEscolar.findUnique({
        where: {
          id,
        },
      });

    if (!eventoExistente) {
      return NextResponse.json(
        { message: "Evento no encontrado" },
        { status: 404 }
      );
    }

    if (turnoId) {
      const turnoExiste = await prisma.turno.findUnique({
        where: {
          id: turnoId,
        },
      });

      if (!turnoExiste) {
        return NextResponse.json(
          { message: "El turno seleccionado no existe" },
          { status: 404 }
        );
      }
    }

    const evento = await prisma.calendarioEscolar.update({
      where: {
        id,
      },
      data: {
        fechaInicio,
        fechaFin,
        tipo,
        descripcion,
        todosLosTurnos,
        turnoId,
        estado:
          body.estado === undefined
            ? eventoExistente.estado
            : Boolean(body.estado),
      },
      include: {
        turno: true,
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "EDITAR",
      modulo: "Calendario escolar",
      detalle: `Actualizó el evento ${evento.descripcion}`,
    });

    return NextResponse.json(evento);
  } catch (error) {
    console.error("Error actualizando evento escolar:", error);

    return NextResponse.json(
      { message: "Error al actualizar el evento del calendario" },
      { status: 500 }
    );
  }
}

/**
 * DELETE
 * Elimina un evento del calendario escolar.
 *
 * Ejemplo:
 * /api/calendario-escolar?id=5
 */
export async function DELETE(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { message: "ID del evento requerido" },
        { status: 400 }
      );
    }

    const evento = await prisma.calendarioEscolar.findUnique({
      where: {
        id,
      },
    });

    if (!evento) {
      return NextResponse.json(
        { message: "Evento no encontrado" },
        { status: 404 }
      );
    }

    await prisma.calendarioEscolar.delete({
      where: {
        id,
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "ELIMINAR",
      modulo: "Calendario escolar",
      detalle: `Eliminó el evento ${evento.tipo}: ${evento.descripcion}`,
    });

    return NextResponse.json({
      message: "Evento eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando evento escolar:", error);

    return NextResponse.json(
      { message: "Error al eliminar el evento del calendario" },
      { status: 500 }
    );
  }
}