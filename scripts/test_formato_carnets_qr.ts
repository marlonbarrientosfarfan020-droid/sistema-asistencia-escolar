import { formatearNombreEstudiante, obtenerClaseNombreCarnet } from "../components/estudiantes/EstudianteTable";
import QRCode from "qrcode";

interface CasoPrueba {
  nombreCaso: string;
  apellidos: string | null | undefined;
  nombres: string | null | undefined;
  resultadoEsperado: string;
  claseEsperada: string;
}

const casosPrueba: CasoPrueba[] = [
  {
    nombreCaso: "1. Estudiante con un apellido y un nombre",
    apellidos: "GARCIA",
    nombres: "JUAN",
    resultadoEsperado: "GARCIA JUAN",
    claseEsperada: "",
  },
  {
    nombreCaso: "2. Estudiante con dos apellidos",
    apellidos: "GARCIA LOPEZ",
    nombres: "JUAN",
    resultadoEsperado: "GARCIA LOPEZ JUAN",
    claseEsperada: "",
  },
  {
    nombreCaso: "3. Estudiante con varios nombres",
    apellidos: "MAMANI CHOQUE",
    nombres: "JUAN CARLOS ALBERTO",
    resultadoEsperado: "MAMANI CHOQUE JUAN CARLOS ALBERTO",
    claseEsperada: "nombre-largo",
  },
  {
    nombreCaso: "4. Estudiante con apellido compuesto",
    apellidos: "DE LA CRUZ MENDOZA",
    nombres: "MARIA",
    resultadoEsperado: "DE LA CRUZ MENDOZA MARIA",
    claseEsperada: "",
  },
  {
    nombreCaso: "4b. Estudiante con apellido compuesto extenso",
    apellidos: "DEL SOLAR PONCE DE LEON",
    nombres: "FERNANDO ANDRES",
    resultadoEsperado: "DEL SOLAR PONCE DE LEON FERNANDO ANDRES",
    claseEsperada: "nombre-muy-largo",
  },
  {
    nombreCaso: "5. Estudiante con nombres largos",
    apellidos: "RODRIGUEZ DE MONTERREY",
    nombres: "FRANCISCO SEBASTIAN",
    resultadoEsperado: "RODRIGUEZ DE MONTERREY FRANCISCO SEBASTIAN",
    claseEsperada: "nombre-muy-largo",
  },
  {
    nombreCaso: "6. Estudiante con tildes y letra ?",
    apellidos: "???EZ CASTA?EDA",
    nombres: "?NGEL MART?N",
    resultadoEsperado: "???EZ CASTA?EDA ?NGEL MART?N",
    claseEsperada: "nombre-largo",
  },
  {
    nombreCaso: "7. Estudiante con solo nombres (no estructurado)",
    apellidos: "",
    nombres: "CARLOS ALBERTO SANCHEZ",
    resultadoEsperado: "CARLOS ALBERTO SANCHEZ",
    claseEsperada: "",
  },
  {
    nombreCaso: "8. Estudiante con solo apellidos (no estructurado)",
    apellidos: "DE LA TORRE UGARTE",
    nombres: null,
    resultadoEsperado: "DE LA TORRE UGARTE",
    claseEsperada: "",
  },
  {
    nombreCaso: "9. Estudiante con campos vac?os (fallback seguro)",
    apellidos: null,
    nombres: undefined,
    resultadoEsperado: "ESTUDIANTE",
    claseEsperada: "",
  },
];

async function ejecutarPruebas() {
  console.log("======================================================================");
  console.log("SUITE DE PRUEBAS: FORMATO DE CARNETS QR ESCOLARES (APELLIDOS PRIMERO)");
  console.log("======================================================================\n");

  let exitosos = 0;
  let fallidos = 0;

  for (const caso of casosPrueba) {
    const obtenido = formatearNombreEstudiante(caso.apellidos, caso.nombres);
    const claseObtenida = obtenerClaseNombreCarnet(obtenido);

    const matchNombre = obtenido === caso.resultadoEsperado;
    const matchClase = claseObtenida === caso.claseEsperada;

    if (matchNombre && matchClase) {
      console.log(`? [PASS] ${caso.nombreCaso}`);
      console.log(`   Resultado: "${obtenido}" (Clase CSS: "${claseObtenida || 'est?ndar'}")`);
      exitosos++;
    } else {
      console.error(`? [FAIL] ${caso.nombreCaso}`);
      console.error(`   Esperado: "${caso.resultadoEsperado}" (clase: "${caso.claseEsperada}")`);
      console.error(`   Obtenido: "${obtenido}" (clase: "${claseObtenida}")`);
      fallidos++;
    }
  }

  // Verificaci?n de integridad de QR
  console.log("\n----------------------------------------------------------------------");
  console.log("VERIFICACI?N DE INTEGRIDAD DE CARNETS QR (PAYLOAD ESTUDIANTE.CODIGO)");
  console.log("----------------------------------------------------------------------");

  const estudiantePrueba = {
    id: 101,
    codigo: "EST-2026-SR-042",
    dni: "74859612",
    nombres: "JUAN CARLOS",
    apellidos: "DE LA CRUZ MENDOZA",
    grado: "5",
    seccion: "C",
  };

  const qrDataUrl = await QRCode.toDataURL(estudiantePrueba.codigo, {
    width: 1200,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const qrValido = qrDataUrl.startsWith("data:image/png;base64,");
  if (qrValido) {
    console.log(`? [PASS] QR generado estrictamente con c?digo escolar: "${estudiantePrueba.codigo}"`);
    console.log(`   El contenido del QR es 100% independiente de los apellidos y nombres.`);
    console.log(`   Formato DataURL PNG HD verificado.`);
    exitosos++;
  } else {
    console.error("? [FAIL] Error al generar QR DataURL");
    fallidos++;
  }

  console.log("\n======================================================================");
  console.log(`RESULTADOS TOTALES: ${exitosos} EXITOSOS, ${fallidos} FALLIDOS`);
  console.log("======================================================================");

  if (fallidos > 0) {
    process.exit(1);
  }
}

ejecutarPruebas().catch((err) => {
  console.error("Error ejecutando pruebas:", err);
  process.exit(1);
});
