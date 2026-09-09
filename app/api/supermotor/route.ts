import { NextResponse } from 'next/server';
import { exigirSesion, exigirAdminODirectivo } from '@/lib/auth';
import { resolverColegio } from '@/lib/tenant';
import {
  obtenerEstadoSuperMotor,
  actualizarEstadoSuperMotor,
  actualizarModuloSuperMotor,
  EstadoJornadaSuperMotor,
  normalizarModulo,
} from '@/lib/supermotor';
import { evaluarJornadaActual } from '@/services/jornada/motorJornada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET: Consultar estado actual del SuperMotor
 * Disponible para usuarios autenticados (ADMIN, DIRECTIVO, DIRECTOR, PERSONAL, DEMO).
 */
export async function GET(request?: Request) {
  const acceso = await exigirSesion(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json(
      { ok: false, message: tenant.message },
      { status: tenant.status }
    );
  }

  const colegioId = tenant.context.colegioId;

  try {
    const estado = await obtenerEstadoSuperMotor(colegioId);
    const evaluacionJornada = await evaluarJornadaActual({ colegioId });

    return NextResponse.json({
      ok: true,
      colegioId,
      motorActivo: estado.motorActivo,
      estadoJornada: estado.estadoJornada,
      modoOperacion: (estado as any).modoOperacion || 'MANUAL',
      horaAperturaJornada: (estado as any).horaAperturaJornada || '06:30',
      horaCierreJornada: (estado as any).horaCierreJornada || '14:30',
      minutosAnticipacionEntrada: (estado as any).minutosAnticipacionEntrada || 60,
      minutosCierreAutomatico: (estado as any).minutosCierreAutomatico || 30,
      asistenciaActivo: estado.asistenciaActivo,
      telegramActivo: estado.telegramActivo,
      whatsappActivo: estado.whatsappActivo,
      reportesActivo: estado.reportesActivo,
      portalActivo: estado.portalActivo,
      iaActivo: estado.iaActivo,
      alertasActivo: estado.alertasActivo,
      fotosActivo: estado.fotosActivo,
      ultimaActivacion: estado.ultimaActivacion,
      ultimoUsuario: estado.ultimoUsuario,
      updatedAt: estado.updatedAt,
      evaluacionJornada,
    });
  } catch (error) {
    console.error('[API SUPERMOTOR] Error al consultar estado:', error);
    return NextResponse.json(
      { ok: false, message: 'Error interno al consultar el SuperMotor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Modificar estado general o submódulos individuales
 * Restringido estrictamente a roles ADMIN y DIRECTOR / DIRECTIVO.
 * Usuarios normales (PERSONAL, DEMO): rechazados con HTTP 403.
 */
export async function PATCH(request: Request) {
  const acceso = await exigirAdminODirectivo(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json(
      { ok: false, message: tenant.message },
      { status: tenant.status }
    );
  }

  const colegioId = tenant.context.colegioId;

  try {
    const body = await request.json();
    const { sesion } = acceso;
    const usuarioResponsable = String(body.usuario || body.usuarioResponsable || sesion.usuario).trim();
    const rol = sesion.rol;

    // Caso 1: Actualización de módulo o motor vía { modulo, activo }
    if (body.modulo !== undefined && body.activo !== undefined) {
      const moduloStr = String(body.modulo).toLowerCase().trim();
      const activo = Boolean(body.activo);

      // Si el módulo solicitado es el motor principal
      if (moduloStr === 'motor' || moduloStr === 'motoractivo') {
        const estadoActualizado = await actualizarEstadoSuperMotor({
          colegioId,
          motorActivo: activo,
          usuario: usuarioResponsable,
          rol,
          motivo: body.motivo || `Motor principal ${activo ? 'activado' : 'apagado'} vía API (${colegioId})`,
        });

        return NextResponse.json({
          ok: true,
          message: `Motor principal ${activo ? 'activado' : 'apagado'} correctamente`,
          colegioId,
          motorActivo: estadoActualizado.motorActivo,
          estado: estadoActualizado,
        });
      }

      // Validar submódulo
      const norm = normalizarModulo(moduloStr);
      if (!norm) {
        return NextResponse.json(
          {
            ok: false,
            message: `Módulo '${moduloStr}' no reconocido. Válidos: motor, asistencia, telegram, whatsapp, reportes, portal, ia, alertas, fotos`,
          },
          { status: 400 }
        );
      }

      const estadoActualizado = await actualizarModuloSuperMotor(
        norm.modulo,
        activo,
        usuarioResponsable,
        rol,
        colegioId
      );

      return NextResponse.json({
        ok: true,
        message: `Módulo ${norm.modulo} ${activo ? 'activado' : 'desactivado'} correctamente`,
        colegioId,
        modulo: norm.modulo,
        activo,
        estado: estadoActualizado,
      });
    }

    // Caso 2: Actualización de motorActivo, estadoJornada, modoOperacion u horarios
    if (
      body.motorActivo !== undefined ||
      body.estadoJornada !== undefined ||
      body.modoOperacion !== undefined ||
      body.horaAperturaJornada !== undefined ||
      body.horaCierreJornada !== undefined ||
      body.minutosAnticipacionEntrada !== undefined ||
      body.minutosCierreAutomatico !== undefined
    ) {
      const estadoActualizado = await actualizarEstadoSuperMotor({
        colegioId,
        motorActivo: body.motorActivo !== undefined ? Boolean(body.motorActivo) : undefined,
        estadoJornada: body.estadoJornada as EstadoJornadaSuperMotor | undefined,
        modoOperacion: body.modoOperacion ? String(body.modoOperacion).toUpperCase() : undefined,
        horaAperturaJornada: body.horaAperturaJornada,
        horaCierreJornada: body.horaCierreJornada,
        minutosAnticipacionEntrada: body.minutosAnticipacionEntrada,
        minutosCierreAutomatico: body.minutosCierreAutomatico,
        usuario: usuarioResponsable,
        rol,
        motivo: body.motivo || `Configuración de estado o jornada en API SuperMotor (${colegioId})`,
      });

      // Si el modo se cambió a AUTOMATICO, evaluar la jornada inmediatamente
      let evaluacion = null;
      if (body.modoOperacion === 'AUTOMATICO') {
        evaluacion = await evaluarJornadaActual({ forzarModo: 'AUTOMATICO', colegioId });
      }

      return NextResponse.json({
        ok: true,
        message: 'Estado del SuperMotor actualizado correctamente',
        colegioId,
        estado: estadoActualizado,
        evaluacion,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: 'Debe especificar { modulo, activo } o { motorActivo, modoOperacion, estadoJornada }',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API SUPERMOTOR] Error al actualizar estado:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || 'Error procesando actualización del SuperMotor' },
      { status: 500 }
    );
  }
}
