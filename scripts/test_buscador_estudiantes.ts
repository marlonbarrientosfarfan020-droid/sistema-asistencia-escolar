import {
  normalizarBusqueda,
  coincideEstudianteConBusqueda,
  formatearNombreEstudiante,
} from "../components/estudiantes/EstudianteTable";

interface EstudianteTest {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  turnoNombre: string;
}

const estudiantesMock: EstudianteTest[] = [
  { id: 1, dni: "74859612", apellidos: "GARCIA LOPEZ", nombres: "JUAN CARLOS", turnoNombre: "MA\u00d1ANA" },
  { id: 2, dni: "74859613", apellidos: "LOPEZ MORALES", nombres: "PEDRO ANTONIO", turnoNombre: "TARDE" },
  { id: 3, dni: "74859614", apellidos: "DE LA CRUZ MENDOZA", nombres: "MARIA ELENA", turnoNombre: "MA\u00d1ANA" },
  { id: 4, dni: "74859615", apellidos: "\u00d1\u00cd\u00d1EZ CASTA\u00d1EDA", nombres: "\u00c1NGEL MART\u00cdN", turnoNombre: "TARDE" },
  { id: 5, dni: "12345678", apellidos: "QUISPE MAMANI", nombres: "JUAN ANDRES", turnoNombre: "MA\u00d1ANA" },
];

function filtrarEstudiantes(
  estudiantes: EstudianteTest[],
  busquedaDni: string,
  turnoFiltro: string,
  busquedaNombre: string
): EstudianteTest[] {
  const terminos = normalizarBusqueda(busquedaNombre).split(/\s+/).filter(Boolean);

  return estudiantes.filter((estudiante) => {
    const coincideDni = !busquedaDni || estudiante.dni.includes(busquedaDni);
    const coincideTurno = turnoFiltro === "TODOS" || estudiante.turnoNombre === turnoFiltro;
    const coincideNombre = coincideEstudianteConBusqueda(
      estudiante.apellidos,
      estudiante.nombres,
      terminos
    );

    return coincideDni && coincideTurno && coincideNombre;
  });
}

function ejecutarPruebas() {
  console.log("======================================================================");
  console.log("SUITE DE PRUEBAS: BUSCADOR POR APELLIDOS Y NOMBRES EN ESTUDIANTES");
  console.log("======================================================================\n");

  let exitosos = 0;
  let fallidos = 0;

  function assert(nombrePrueba: string, condicion: boolean, detalle: string) {
    if (condicion) {
      console.log(`PASS: ${nombrePrueba} -> ${detalle}`);
      exitosos++;
    } else {
      console.error(`FAIL: ${nombrePrueba} -> ${detalle}`);
      fallidos++;
    }
  }

  // 1. Buscar por apellido
  const r1 = filtrarEstudiantes(estudiantesMock, "", "TODOS", "GARCIA");
  assert("1. Buscar por apellido 'GARCIA'", r1.length === 1 && r1[0].id === 1, `Encontro ${r1.length} estudiantes (ID: ${r1.map(e => e.id).join(",")})`);

  // 2. Buscar por nombre
  const r2 = filtrarEstudiantes(estudiantesMock, "", "TODOS", "JUAN");
  assert("2. Buscar por nombre 'JUAN'", r2.length === 2 && r2.some(e => e.id === 1) && r2.some(e => e.id === 5), `Encontro ${r2.length} estudiantes (IDs: ${r2.map(e => e.id).join(",")})`);

  // 3. Buscar por varios terminos en distintos ordenes
  const r3a = filtrarEstudiantes(estudiantesMock, "", "TODOS", "GARCIA LOPEZ");
  assert("3a. Varios terminos 'GARCIA LOPEZ'", r3a.length === 1 && r3a[0].id === 1, `Encontro ${r3a.length} estudiante`);

  const r3b = filtrarEstudiantes(estudiantesMock, "", "TODOS", "GARCIA JUAN");
  assert("3b. Varios terminos 'GARCIA JUAN'", r3b.length === 1 && r3b[0].id === 1, `Encontro ${r3b.length} estudiante`);

  const r3c = filtrarEstudiantes(estudiantesMock, "", "TODOS", "JUAN GARCIA");
  assert("3c. Varios terminos inverso 'JUAN GARCIA'", r3c.length === 1 && r3c[0].id === 1, `Encontro ${r3c.length} estudiante`);

  // 4. Buscar con tildes y sin tildes
  const r4a = filtrarEstudiantes(estudiantesMock, "", "TODOS", "Garc\u00eda");
  assert("4a. Busqueda con tilde 'Garcia'", r4a.length === 1 && r4a[0].id === 1, `Encontro ${r4a.length} estudiante`);

  const r4b = filtrarEstudiantes(estudiantesMock, "", "TODOS", "\u00c1NGEL");
  assert("4b. Busqueda con tilde 'ANGEL'", r4b.length === 1 && r4b[0].id === 4, `Encontro ${r4b.length} estudiante`);

  const r4c = filtrarEstudiantes(estudiantesMock, "", "TODOS", "angel martin");
  assert("4c. Busqueda sin tilde 'angel martin' para alumno 'ANGEL MARTIN'", r4c.length === 1 && r4c[0].id === 4, `Encontro ${r4c.length} estudiante`);

  // 5. Buscar con letra N / Enie
  const r5a = filtrarEstudiantes(estudiantesMock, "", "TODOS", "\u00d1\u00cd\u00d1EZ");
  assert("5a. Busqueda con Enie y tilde 'NINEZ'", r5a.length === 1 && r5a[0].id === 4, `Encontro ${r5a.length} estudiante`);

  const r5b = filtrarEstudiantes(estudiantesMock, "", "TODOS", "ninez castaneda");
  assert("5b. Busqueda sin Enie ni tildes 'ninez castaneda'", r5b.length === 1 && r5b[0].id === 4, `Encontro ${r5b.length} estudiante`);

  // 6. Apellidos compuestos
  const r6 = filtrarEstudiantes(estudiantesMock, "", "TODOS", "DE LA CRUZ");
  assert("6. Apellido compuesto 'DE LA CRUZ'", r6.length === 1 && r6[0].id === 3, `Encontro ${r6.length} estudiante`);

  // 7. Combinar con DNI
  const r7 = filtrarEstudiantes(estudiantesMock, "74859612", "TODOS", "GARCIA");
  assert("7. Combinar con DNI '74859612' + 'GARCIA'", r7.length === 1 && r7[0].id === 1, `Encontro ${r7.length} estudiante`);

  const r7_no = filtrarEstudiantes(estudiantesMock, "12345678", "TODOS", "GARCIA");
  assert("7b. Combinar con DNI incompatible '12345678' + 'GARCIA'", r7_no.length === 0, `0 resultados (correcto)`);

  // 8. Combinar con Turno
  const r8a = filtrarEstudiantes(estudiantesMock, "", "MA\u00d1ANA", "JUAN");
  assert("8a. Combinar Turno 'MANANA' + 'JUAN'", r8a.length === 2 && r8a.every(e => e.turnoNombre === "MA\u00d1ANA"), `Encontro ${r8a.length} estudiantes`);

  const r8b = filtrarEstudiantes(estudiantesMock, "", "TARDE", "JUAN");
  assert("8b. Combinar Turno 'TARDE' + 'JUAN'", r8b.length === 0, `0 resultados en turno incompatible`);

  // 9. Combinar DNI + Turno + Nombre
  const r9 = filtrarEstudiantes(estudiantesMock, "74859612", "MA\u00d1ANA", "CARLOS GARCIA");
  assert("9. Combinacion triple (DNI 74859612 + MANANA + CARLOS GARCIA)", r9.length === 1 && r9[0].id === 1, `Encontro ${r9.length} estudiante`);

  // 10. Limpiar filtros
  const r10 = filtrarEstudiantes(estudiantesMock, "", "TODOS", "");
  assert("10. Limpiar filtros (vacio)", r10.length === estudiantesMock.length, `Muestra todos los ${r10.length} estudiantes`);

  // 11. Formato de Carnet APELLIDOS PRIMERO preservado
  const nombreCarnet = formatearNombreEstudiante("GARCIA LOPEZ", "JUAN CARLOS");
  assert("11. Formato de carnet QR preservado", nombreCarnet === "GARCIA LOPEZ JUAN CARLOS", `Formato carnet: "${nombreCarnet}"`);

  console.log("\n======================================================================");
  console.log(`TOTALES: ${exitosos} EXITOSOS, ${fallidos} FALLIDOS`);
  console.log("======================================================================");

  if (fallidos > 0) {
    process.exit(1);
  }
}

ejecutarPruebas();
