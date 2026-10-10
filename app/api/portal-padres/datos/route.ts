import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionPadre } from "@/lib/auth-padres";
import {
  fechaPeru,
  ahoraPeru,
  crearFechaHoraPeru,
} from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirSesionPadre(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const { sesion } = acceso;

  try {
    // 1. Verificar si el portal de consultas web est� habilitado en configuraci�n global (Mantenimiento manual)
    const config = await prisma.configuracion.findFirst({
      select: {
        nombreColegio: true,
        logoUrl: true,
        telefono: true,
        correo: true,
        canalPortalWebActivo: true,
      },
    });

    if (config && config.canalPortalWebActivo === false) {
      return NextResponse.json(
        {
          ok: false,
          estado: "bloqueado",
          message: "El portal web de consultas para familias se encuentra temporalmente en mantenimiento por direcci�n escolar.",
          mensaje: "El portal web de consultas para familias se encuentra temporalmente en mantenimiento por direcci�n escolar.",
        },
        { status: 403 }
      );
    }

    // 2. Extraer par�metros y validar autorizaci�n contra la sesi�n
    const estudianteAutorizadoId = Number(sesion.estudianteAutorizadoId || 0);
    const estudiantesPermitidosIds = Array.isArray(sesion.estudiantesPermitidosIds)
      ? sesion.estudiantesPermitidosIds.map(Number)
      : estudianteAutorizadoId ? [estudianteAutorizadoId] : [];

    if (!estudianteAutorizadoId || estudiantesPermitidosIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Sesi�n familiar incompleta o desactualizada. Por favor inicie sesi�n nuevamente.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const estudianteIdParam = searchParams.get("estudianteId");
    const estudianteIdSolicitado = estudianteIdParam ? Number(estudianteIdParam) : estudianteAutorizadoId;

    if (!estudiantesPermitidosIds.includes(estudianteIdSolicitado)) {
      console.warn(
        `[PORTAL SEGURIDAD] Intento de acceso no autorizado bloqueado: Familia ${sesion.codigoFamiliar} intent� consultar estudianteId=${estudianteIdSolicitado}`
      );
      return NextResponse.json(
        {
          ok: false,
          message: "Acceso no autorizado: la estudiante solicitada no pertenece a su grupo familiar autorizado.",
        },
        { status: 403 }
      );
    }

    // 3. VALIDACI�N EN POSTGRESQL EN CADA SOLICITUD:
    // Comprobar que la estudiante exista, est� activa y mantenga relaci�n vigente con la familia en PostgreSQL
    const colegioId = sesion.colegioId || "SANTA_RITA_001";

    const [estudianteActiva, hermanosConfirmados, familiaInfo] = await Promise.all([
      prisma.estudiante.findFirst({
        where: {
          id: estudianteIdSolicitado,
          colegioId,
          codigoFamiliarId: sesion.codigoFamiliarId,
          estado: true,
        },
        include: {
          turno: {
            select: {
              id: true,
              nombre: true,
              horaEntrada: true,
              horaSalida: true,
              estado: true,
              minutosAlertaInicial: true,
              margenAlertaMinutos: true,
            },
          },
        },
      }),
      prisma.estudiante.findMany({
        where: {
          id: { in: estudiantesPermitidosIds },
          colegioId,
          codigoFamiliarId: sesion.codigoFamiliarId,
          estado: true,
        },
        select: {
          id: true,
          codigo: true,
          dni: true,
          nombres: true,
          apellidos: true,
          grado: true,
          seccion: true,
          turno: {
            select: {
              id: true,
              nombre: true,
              horaEntrada: true,
              horaSalida: true,
            },
          },
        },
        orderBy: [{ grado: "asc" }, { seccion: "asc" }, { apellidos: "asc" }],
      }),
      prisma.codigoFamiliar.findUnique({
        where: { id: sesion.codigoFamiliarId },
        select: {
          id: true,
          codigo: true,
          tutorTitular: true,
          telefonoContacto: true,
          ultimoIngresoAt: true,
          estado: true,
        },
      }),
    ]);

    // Si la familia fue suspendida en PostgreSQL
    if (!familiaInfo || !familiaInfo.estado) {
      return NextResponse.json(
        { ok: false, message: "El acceso familiar ha sido suspendido por direcci�n escolar." },
        { status: 403 }
      );
    }

    // Si la estudiante fue desvinculada o retirada en PostgreSQL
    if (!estudianteActiva) {
      return NextResponse.json(
        { ok: false, message: "La estudiante autorizada no fue encontrada o su asignaci�n familiar fue revocada." },
        { status: 403 }
      );
    }

    // 4. Obtener asistencias EXCLUSIVAS de la estudiante activa (�ltimos 60 registros)
    const asistencias = await prisma.asistencia.findMany({
      where: {
        estudianteId: estudianteActiva.id,
        colegioId,
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
        salidaExcepcional: {
          select: {
            motivo: true,
            motivoDetalle: true,
            observacion: true,
            usuarioRegistro: true,
          },
        },
      },
    });

    // 5. EVALUAR AUSENCIA VIRTUAL DE HOY (DISPONIBLE 24/7)
    const hoyStr = fechaPeru();
    const ahora = ahoraPeru();
    const fechaHoyBD = new Date(`${hoyStr}T00:00:00.000Z`);

    const eventoNoLectivo = await prisma.calendarioEscolar.findFirst({
      where: {
        colegioId,
        estado: true,
        fechaInicio: { lte: fechaHoyBD },
        fechaFin: { gte: fechaHoyBD },
        OR: [
          { todosLosTurnos: true },
          { turnoId: (estudianteActiva as any).turnoId || undefined },
        ],
      },
    }).catch(() => null);

    const esDiaNoLectivo = Boolean(eventoNoLectivo);

    const tieneAsistenciaHoy = asistencias.some((a) => {
      if (a.fechaDia === hoyStr) return true;
      return fechaPeru(new Date(a.fecha)) === hoyStr;
    });

    const turno = estudianteActiva.turno;
    const esTurnoActivo = Boolean(turno && turno.estado === true);
    let horaSalidaSuperada = false;

    if (turno?.horaSalida) {
      const horaSalidaTurno = crearFechaHoraPeru(hoyStr, turno.horaSalida);
      horaSalidaSuperada = ahora >= horaSalidaTurno;
    }

    const esAusenciaVirtualHoy =
      !tieneAsistenciaHoy &&
      esTurnoActivo &&
      !esDiaNoLectivo &&
      horaSalidaSuperada;

    // 6. M�tricas de puntualidad
    const faltasHistoricas = asistencias.filter(
      (a) => a.estado === "AUSENTE" || a.estado === "FALTA"
    ).length;
    const faltas = faltasHistoricas + (esAusenciaVirtualHoy ? 1 : 0);

    const puntuales = asistencias.filter((a) => a.estado === "PUNTUAL").length;
    const tardanzas = asistencias.filter(
      (a) => a.estado === "TARDANZA" || a.estado === "TARDE"
    ).length;
    const justificados = asistencias.filter((a) => a.estado === "JUSTIFICADO").length;

    const totalRegistros = asistencias.length + (esAusenciaVirtualHoy ? 1 : 0);

    const porcentajePuntualidad =
      totalRegistros > 0 ? Math.round((puntuales / totalRegistros) * 100) : 0;

    const distribucionDona = [
      { name: "Puntual", valor: puntuales, color: "#10B981" },
      { name: "Tardanza", valor: tardanzas, color: "#F59E0B" },
    ];

    if (justificados > 0) {
      distribucionDona.push({ name: "Justificado", valor: justificados, color: "#6366F1" });
    }

    if (faltas > 0) {
      distribucionDona.push({ name: "Faltas / Ausencias", valor: faltas, color: "#EF4444" });
    }

    // 7. OFUSCACI�N SEGURA DE FOTOGRAF�AS: En lugar de exponer URLs p�blicas de Blob,
    // devolver la ruta proxy segura que exige sesi�n y relaci�n activa en PostgreSQL
    const asistenciasSeguras = asistencias.map((a) => ({
      ...a,
      fotoEntrada: a.fotoEntrada ? `/api/portal-padres/foto?asistenciaId=${a.id}&tipo=ENTRADA` : null,
      fotoSalida: a.fotoSalida ? `/api/portal-padres/foto?asistenciaId=${a.id}&tipo=SALIDA` : null,
      fotoUrl: a.fotoUrl || a.fotoEntrada ? `/api/portal-padres/foto?asistenciaId=${a.id}&tipo=ENTRADA` : null,
    }));

    const listaAsistencias = esAusenciaVirtualHoy
      ? [
          {
            id: -1,
            fecha: ahora.toISOString(),
            fechaDia: hoyStr,
            horaEntrada: null,
            horaSalida: null,
            metodo: "SISTEMA",
            estado: "AUSENTE",
            estadoJornada: "CERRADA",
            estadoSalida: null,
            fotoEntrada: null,
            fotoSalida: null,
            fotoUrl: null,
          },
          ...asistenciasSeguras,
        ]
      : asistenciasSeguras;

    // Gr�fico mensual
    const mapaMeses = new Map<string, { mes: string; puntuales: number; tardanzas: number }>();
    const nombresMeses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Set", "Oct", "Nov", "Dic"
    ];

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
      if (a.estado === "TARDANZA" || a.estado === "TARDE") item.tardanzas++;
    }

    const barrasMeses = Array.from(mapaMeses.values());

    return NextResponse.json({
      ok: true,
      familia: {
        id: familiaInfo.id,
        codigo: familiaInfo.codigo,
        tutorTitular: familiaInfo.tutorTitular || sesion.tutorTitular,
        telefonoContacto: familiaInfo.telefonoContacto || "",
        ultimoIngresoAt: familiaInfo.ultimoIngresoAt || null,
      },
      estudiantes: hermanosConfirmados,
      estudianteActiva: {
        id: estudianteActiva.id,
        codigo: estudianteActiva.codigo,
        dni: estudianteActiva.dni,
        nombres: estudianteActiva.nombres,
        apellidos: estudianteActiva.apellidos,
        grado: estudianteActiva.grado,
        seccion: estudianteActiva.seccion,
        turno: estudianteActiva.turno,
        estadoHoy: esAusenciaVirtualHoy ? "AUSENTE" : (tieneAsistenciaHoy ? "PRESENTE" : "PENDIENTE"),
      },
      metricasEstudiante: {
        totalRegistros,
        puntuales,
        tardanzas,
        justificados,
        faltas,
        porcentajePuntualidad,
        estadoHoy: esAusenciaVirtualHoy ? "AUSENTE" : (tieneAsistenciaHoy ? "PRESENTE" : "PENDIENTE"),
      },
      distribucionDona,
      barrasMeses,
      asistencias: listaAsistencias,
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
      { ok: false, message: "Error interno al obtener datos de asistencia familiar" },
      { status: 500 }
    );
  }
}
