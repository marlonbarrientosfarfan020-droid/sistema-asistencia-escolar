import {
  procesarAlertasAsistencia,
} from "@/services/automatizaciones/procesarAlertas";

/*
 * Se conserva el nombre revisarAusentes
 * para no romper las APIs y schedulers existentes.
 */
export async function revisarAusentes() {
  return procesarAlertasAsistencia();
}