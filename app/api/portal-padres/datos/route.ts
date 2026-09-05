import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionPadre } from "@/lib/auth-padres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirSesionPadre();
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const { codigoFamiliarId } = acceso.sesion;

  try {
    const { searchParams } = new URL(request.url);
    const estudianteIdParam = searchParams.get("estudianteId");

    // 1. Obtener familia y configuración
    const [familia, config] = await Promise.all([
      prisma.codigoFamiliar.findUnique({
        where: { id: codigoFamiliarId },
        include: {
          estudiantes: {
            where: { estado: true },
            include: {
              turno: {
                select: {
                  nombre: true,
                  horaEntrada: true,
                  horaSalida: true,
                },
              },
            },
            orderBy: [{ grado: "asc" }, { seccion: "asc" }, { apellidos: "asc" }],
          },
        },
      }),
      prisma.configuracion.findFirst({
        select: {
          nombreColegio: true,
          logoUrl: true,
          telefono: true,
          correo: true,
          canalPortalWebActivo: true,
        },
      }),
    ]);

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado en el sistema" },
        { status: 404 }
      );
    }

    if (!familia.estado) {
      return NextResponse.json(
        { ok: false, message: "El acceso para este código familiar está suspendido" },
        { status: 403 }
      );
    }

    if (familia.estudiantes.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No hay estudiantes vinculadas a este código familiar" },
        { status: 404 }
      );
    }

    // 2. Determinar estudiante activa
    let estudianteActiva = familia.estudiantes[0];
    if (estudianteIdParam) {
      const encontrada = familia.estudiantes.find(
        (e) => e.id === Number(estudianteIdParam)
      );
      if (encontrada) {
        estudianteActiva = encontrada;
      }
    }

    // 3. Obtener asistencias de la estudiante activa (últimos 60 registros)
    const asistencias = await prisma.asistencia.findMany({
      where: {
        estudianteId: estudianteActiva.id,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 60,
      select: {
        id: true,
        fecha: true,
        fechaDia: true,
        horaEntrada: true,
        horaSalida: true,
        metodo: true,
        estado: true,
        estadoJornada: true,
        estadoSalida: true,
        fotoEntrada: true,
        fotoSalida: true,
        fotoUrl: true,
      },
    });

    // 4. Calcular métricas de la estudiante
    const totalRegistros = asistencias.length;
    const puntuales = asistencias.filter((a) => a.estado === "PUNTUAL").length;
    const tardanzas = asistencias.filter((a) => a.estado === "TARDANZA").length;
    const justificados = asistencias.filter((a) => a.estado === "JUSTIFICADO").length;

    const porcentajePuntualidad =
      totalRegistros > 0 ? Math.round((puntuales / totalRegistros) * 100) : 0;

    const distribucionDona = [
      { name: "Puntual", valor: puntuales, color: "#10B981" },
      { name: "Tardanza", valor: tardanzas, color: "#F59E0B" },
    ];

    if (justificados > 0) {
      distribucionDona.push({ name: "Justificado", valor: justificados, color: "#6366F1" });
    }

    // Agrupación de asistencias por mes para gráfica de barras
    const mapaMeses = new Map<string, { mes: string; puntuales: number; tardanzas: number }>();
    const nombresMeses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Set", "Oct", "Nov", "Dic"
    ];

    // Orden cronológico ascendente para el gráfico
    const asistenciasAsc = [...asistencias].reverse();
    for (const a of asistenciasAsc) {
      const d = new Date(a.fecha);
      const claveMes = `${d.getFullYear()}-${d.getMonth()}`;
      const etiqueta = `${nombresMeses[d.getMonth()]} ${d.getFullYear()}`;

      if (!mapaMeses.has(claveMes)) {
        mapaMeses.set(claveMes, { mes: etiqueta, puntuales: 0, tardanzas: 0 });
      }

      const item = mapaMeses.get(claveMes)!;
      if (a.estado === "PUNTUAL") item.puntuales++;
      if (a.estado === "TARDANZA") item.tardanzas++;
    }

    const barrasMeses = Array.from(mapaMeses.values());

    return NextResponse.json({
      ok: true,
      familia: {
        id: familia.id,
        codigo: familia.codigo,
        tutorTitular: familia.tutorTitular,
        telefonoContacto: familia.telefonoContacto,
        ultimoIngresoAt: familia.ultimoIngresoAt,
      },
      estudiantes: familia.estudiantes.map((e) => ({
        id: e.id,
        codigo: e.codigo,
        dni: e.dni,
        nombres: e.nombres,
        apellidos: e.apellidos,
        grado: e.grado,
        seccion: e.seccion,
        turno: e.turno,
      })),
      estudianteActiva: {
        id: estudianteActiva.id,
        codigo: estudianteActiva.codigo,
        dni: estudianteActiva.dni,
        nombres: estudianteActiva.nombres,
        apellidos: estudianteActiva.apellidos,
        grado: estudianteActiva.grado,
        seccion: estudianteActiva.seccion,
        turno: estudianteActiva.turno,
      },
      metricasEstudiante: {
        totalRegistros,
        puntuales,
        tardanzas,
        justificados,
        porcentajePuntualidad,
      },
      distribucionDona,
      barrasMeses,
      asistencias,
      infoColegio: {
        nombreColegio: config?.nombreColegio || "I.E.P. Santa Rita de Cassia",
        logoUrl: config?.logoUrl || "/img/logo-santa-rita.png",
        telefono: config?.telefono || "(01) 581-2244",
        correo: config?.correo || "contacto@santaritadecassia.edu.pe",
      },
    });
  } catch (error) {
    console.error("Error obteniendo datos del portal de padres:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al obtener datos de asistencia" },
      { status: 500 }
    );
  }
}
