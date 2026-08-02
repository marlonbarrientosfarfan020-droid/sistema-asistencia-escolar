type DatosEstudianteAlerta = {
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;

  turno: {
    nombre: string;
    horaEntrada: string;
    horaSalida: string;
    margenAlertaMinutos: number;
  };
};

function nombreCompleto(
  estudiante: DatosEstudianteAlerta
) {
  return `${estudiante.nombres} ${estudiante.apellidos}`;
}

function datosBase(
  estudiante: DatosEstudianteAlerta
) {
  return `🏫 I.E. Santa Rita de Casia

👨‍🎓 Estudiante:
${nombreCompleto(estudiante)}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

⏰ Turno:
${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`;
}

export function mensajeIngresoPendiente(
  estudiante: DatosEstudianteAlerta
) {
  return `🟡 AVISO DE INGRESO PENDIENTE

${datosBase(estudiante)}

🕒 El estudiante todavía no registra ingreso al colegio.

Aún se encuentra dentro del margen permitido de ${estudiante.turno.margenAlertaMinutos} minutos y todavía no ha sido considerado tardanza.

Por favor, verificar si el estudiante se encuentra en camino.`;
}

export function mensajeTardanza(
  estudiante: DatosEstudianteAlerta
) {
  return `🟠 ALERTA DE TARDANZA

${datosBase(estudiante)}

⚠️ El estudiante todavía no registra ingreso y ya superó el margen permitido de ${estudiante.turno.margenAlertaMinutos} minutos.

Todavía puede ingresar, pero será registrado con estado TARDE.

Por favor, comunicarse con la institución o verificar la situación del estudiante.`;
}

export function mensajeAusenciaConfirmada(
  estudiante: DatosEstudianteAlerta
) {
  return `🚨 AUSENCIA CONFIRMADA

${datosBase(estudiante)}

❌ El estudiante no registró ingreso durante toda la jornada escolar.

Ha sido considerado AUSENTE en la fecha de hoy.

Por favor, comunicarse con la institución para informar o justificar la inasistencia.`;
}