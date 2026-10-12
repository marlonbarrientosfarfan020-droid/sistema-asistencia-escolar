/**
 * CATÁLOGO CENTRALIZADO DE LOS 23 MÓDULOS OPERATIVOS DEL SISTEMA
 *
 * Mapeo exacto 1:1 con las rutas y agrupaciones reales de la aplicación.
 * Excluye explícitamente el módulo Auditoría de los accesos visuales.
 */

export type CategoriaModulo =
  | "Panel"
  | "Gestión"
  | "Inteligencia artificial"
  | "Administración"
  | "Desarrollo"
  | "Operación";

export type ModuloDefinicion = {
  id: string;
  nombre: string;
  ruta: string;
  rutasSecundarias?: string[];
  apis?: string[];
  icono: string;
  categoria: CategoriaModulo;
  descripcion: string;
  soloAdmin?: boolean;
};

export const MODULOS_OPERATIVOS: ModuloDefinicion[] = [
  // 1. Panel (1 módulo)
  {
    id: "dashboard",
    nombre: "Dashboard",
    ruta: "/dashboard",
    icono: "🏠",
    categoria: "Panel",
    descripcion: "Panel de control principal con indicadores operativos en tiempo real",
  },

  // 2. Gestión (8 módulos)
  {
    id: "estudiantes",
    nombre: "Estudiantes",
    ruta: "/dashboard/estudiantes",
    rutasSecundarias: ["/dashboard/estudiantes/"],
    apis: ["/api/estudiantes"],
    icono: "🎓",
    categoria: "Gestión",
    descripcion: "Padrón estudiantil, credenciales escolares y registros biométricos",
  },
  {
    id: "padres",
    nombre: "Familias / Padres",
    ruta: "/dashboard/padres",
    rutasSecundarias: ["/dashboard/padres/"],
    apis: ["/api/padres"],
    icono: "👨‍👩‍👧",
    categoria: "Gestión",
    descripcion: "Directorio de apoderados, códigos familiares y credenciales del portal",
  },
  {
    id: "asistencias",
    nombre: "Asistencias",
    ruta: "/dashboard/asistencias",
    apis: ["/api/asistencias", "/api/asistencias/foto"],
    icono: "✅",
    categoria: "Gestión",
    descripcion: "Registro diario de asistencias, visualización de evidencias y justificaciones",
  },
  {
    id: "salidas",
    nombre: "Gestión de Salidas",
    ruta: "/dashboard/salidas",
    apis: ["/api/salidas-excepcionales"],
    icono: "🚪",
    categoria: "Gestión",
    descripcion: "Control y registro de salidas anticipadas y retiros excepcionales autorizados",
  },
  {
    id: "tardanzas",
    nombre: "Tardanzas",
    ruta: "/dashboard/tardanzas",
    apis: ["/api/tardanzas"],
    icono: "⏰",
    categoria: "Gestión",
    descripcion: "Monitoreo de ingresos fuera de horario y tolerancias de puntualidad",
  },
  {
    id: "ausentes",
    nombre: "Ausentes",
    ruta: "/dashboard/ausentes",
    apis: ["/api/ausentes", "/api/alertas/ausentes"],
    icono: "🚫",
    categoria: "Gestión",
    descripcion: "Detección de inasistencias en vivo y gestión de alertas preventivas",
  },
  {
    id: "reporte_estudiante",
    nombre: "Reporte estudiante",
    ruta: "/dashboard/reporte-estudiante",
    apis: ["/api/reportes/estudiante"],
    icono: "📄",
    categoria: "Gestión",
    descripcion: "Ficha individual y consolidado histórico por estudiante",
  },
  {
    id: "reportes_mensuales",
    nombre: "Reportes mensuales",
    ruta: "/dashboard/reportes-mensuales",
    apis: ["/api/reportes/mensual", "/api/reportes/automatico"],
    icono: "📈",
    categoria: "Gestión",
    descripcion: "Consolidados mensuales, estadísticas de asistencia y exportación oficial",
  },

  // 3. Inteligencia Artificial (4 módulos)
  {
    id: "inteligencia",
    nombre: "Inteligencia Escolar",
    ruta: "/dashboard/inteligencia",
    apis: ["/api/ia/anomalias", "/api/ia/riesgo-estudiante"],
    icono: "🤖",
    categoria: "Inteligencia artificial",
    descripcion: "Análisis predictivo de riesgo de deserción y patrones de asistencia con IA",
  },
  {
    id: "inteligencia_institucional",
    nombre: "Inteligencia y Reportes IA",
    ruta: "/dashboard/inteligencia-institucional",
    apis: ["/api/inteligencia-institucional"],
    icono: "🧠",
    categoria: "Inteligencia artificial",
    descripcion: "Informes institucionales ejecutivos generados automáticamente por IA",
  },
  {
    id: "ranking_ia",
    nombre: "Ranking IA",
    ruta: "/dashboard/inteligencia/ranking",
    apis: ["/api/ia/ranking-riesgo"],
    icono: "🏆",
    categoria: "Inteligencia artificial",
    descripcion: "Clasificación inteligente de grados y secciones según puntualidad y riesgo",
  },
  {
    id: "historial_ia",
    nombre: "Historial IA",
    ruta: "/dashboard/inteligencia/historial",
    apis: ["/api/ia/historial"],
    icono: "🗂️",
    categoria: "Inteligencia artificial",
    descripcion: "Bitácora histórica de análisis y predicciones ejecutadas",
  },

  // 4. Administración (8 módulos sin Auditoría)
  {
    id: "supermotor",
    nombre: "SuperMotor",
    ruta: "/dashboard/supermotor",
    apis: ["/api/supermotor"],
    icono: "🚀",
    categoria: "Administración",
    descripcion: "Control del motor operativo de jornadas y sincronización institucional",
  },
  {
    id: "monitoreo",
    nombre: "Monitoreo y Salud",
    ruta: "/dashboard/monitoreo",
    apis: ["/api/health"],
    icono: "🩺",
    categoria: "Administración",
    descripcion: "Telemetría, estado de la base de datos, servicios y verificación de salud",
  },
  {
    id: "calendario",
    nombre: "Calendario escolar",
    ruta: "/dashboard/calendario",
    apis: ["/api/calendario-escolar"],
    icono: "🗓️",
    categoria: "Administración",
    descripcion: "Gestión de días lectivos, feriados, vacaciones y excepciones de turnos",
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    ruta: "/dashboard/usuarios",
    apis: ["/api/usuarios"],
    icono: "👥",
    categoria: "Administración",
    descripcion: "Administración de cuentas de usuario y control dinámico de accesos",
    soloAdmin: true,
  },
  {
    id: "turnos",
    nombre: "Turnos",
    ruta: "/dashboard/turnos",
    apis: ["/api/turnos"],
    icono: "⏱️",
    categoria: "Administración",
    descripcion: "Horarios de entrada, salida, márgenes y tolerancias de los turnos escolares",
  },
  {
    id: "automatizaciones",
    nombre: "Automatizaciones",
    ruta: "/dashboard/automatizaciones",
    apis: ["/api/automatizaciones", "/api/cron/automatizaciones"],
    icono: "⚡",
    categoria: "Administración",
    descripcion: "Programación de envíos automáticos de reportes y alertas a padres",
  },
  {
    id: "configuracion",
    nombre: "Configuración",
    ruta: "/dashboard/configuracion",
    apis: ["/api/configuracion"],
    icono: "🔧",
    categoria: "Administración",
    descripcion: "Parámetros institucionales, logotipo del colegio y canales de mensajería",
  },
  {
    id: "backup",
    nombre: "Backup",
    ruta: "/dashboard/backup",
    apis: ["/api/backup", "/api/backup/restaurar"],
    icono: "💾",
    categoria: "Administración",
    descripcion: "Generación y descarga de copias de seguridad de la base de datos",
    soloAdmin: true,
  },

  // 5. Desarrollo (1 módulo)
  {
    id: "modo_desarrollador",
    nombre: "Modo desarrollador",
    ruta: "/dashboard/modo-desarrollador",
    apis: ["/api/desarrollador/reiniciar-sistema"],
    icono: "🧪",
    categoria: "Desarrollo",
    descripcion: "Herramientas de simulación, logs de depuración y pruebas técnicas",
    soloAdmin: true,
  },

  // 6. Operación (1 módulo)
  {
    id: "marcar",
    nombre: "Marcar asistencia",
    ruta: "/marcar",
    apis: ["/api/terminales/verificar"],
    icono: "📲",
    categoria: "Operación",
    descripcion: "Terminal Escolar V2 con escaneo QR de fotograma completo y reconocimiento facial",
  },
];

// Mapa indexado por ID para acceso O(1)
export const MAPA_MODULOS: Record<string, ModuloDefinicion> = MODULOS_OPERATIVOS.reduce(
  (acc, mod) => {
    acc[mod.id] = mod;
    return acc;
  },
  {} as Record<string, ModuloDefinicion>
);

// Módulos agrupados por categoría para renderizado en casillas y menús
export const CATEGORIAS_MODULOS: CategoriaModulo[] = [
  "Panel",
  "Gestión",
  "Inteligencia artificial",
  "Administración",
  "Desarrollo",
  "Operación",
];

export const MODULOS_POR_CATEGORIA = CATEGORIAS_MODULOS.reduce((acc, cat) => {
  acc[cat] = MODULOS_OPERATIVOS.filter((m) => m.categoria === cat);
  return acc;
}, {} as Record<CategoriaModulo, ModuloDefinicion[]>);

// Plantillas de roles útiles para asignar grupos de casillas rápidamente
export const PLANTILLAS_ROLES: Record<string, { etiqueta: string; modulos: string[] }> = {
  ADMIN: {
    etiqueta: "Administrador General",
    modulos: MODULOS_OPERATIVOS.map((m) => m.id),
  },
  DIRECTIVO: {
    etiqueta: "Directivo / Director",
    modulos: [
      "dashboard",
      "estudiantes",
      "padres",
      "asistencias",
      "salidas",
      "tardanzas",
      "ausentes",
      "reporte_estudiante",
      "reportes_mensuales",
      "inteligencia",
      "inteligencia_institucional",
      "ranking_ia",
      "historial_ia",
      "calendario",
      "turnos",
      "automatizaciones",
      "configuracion",
      "monitoreo",
    ],
  },
  DOCENTE: {
    etiqueta: "Docente / Auxiliar",
    modulos: [
      "dashboard",
      "estudiantes",
      "asistencias",
      "salidas",
      "tardanzas",
      "ausentes",
      "reporte_estudiante",
      "marcar",
    ],
  },
  SECRETARIA: {
    etiqueta: "Secretaría Académica",
    modulos: [
      "dashboard",
      "estudiantes",
      "padres",
      "asistencias",
      "salidas",
      "tardanzas",
      "ausentes",
      "reporte_estudiante",
      "reportes_mensuales",
      "calendario",
    ],
  },
  PORTERIA: {
    etiqueta: "Portería / Control de Puerta",
    modulos: ["marcar", "salidas", "monitoreo"],
  },
  DEMO: {
    etiqueta: "Modo Demostración",
    modulos: [
      "dashboard",
      "estudiantes",
      "padres",
      "asistencias",
      "reportes_mensuales",
      "inteligencia",
      "marcar",
    ],
  },
};

/**
 * Obtiene los módulos permitidos para un rol base si el usuario aún no tiene configuración explícita
 */
export function obtenerModulosPorRol(rol: string): string[] {
  const r = (rol || "").toUpperCase();
  if (r === "SUPER_ADMIN" || r === "ADMIN" || r === "ADMIN_COLEGIO") {
    return MODULOS_OPERATIVOS.map((m) => m.id);
  }
  if (PLANTILLAS_ROLES[r]) {
    return PLANTILLAS_ROLES[r].modulos;
  }
  return ["dashboard", "asistencias", "marcar"];
}

/**
 * Verifica si una ruta pertenece a un módulo autorizado
 */
export function esRutaPermitida(
  pathname: string,
  modulosPermitidos: string[],
  esAdmin = false
): boolean {
  if (esAdmin) return true;
  if (!pathname) return false;

  // Rutas públicas o de error siempre permitidas
  if (
    pathname === "/dashboard/acceso-denegado" ||
    pathname === "/login" ||
    pathname === "/"
  ) {
    return true;
  }

  // Buscar el módulo al que corresponde la ruta
  for (const mod of MODULOS_OPERATIVOS) {
    const coincideRuta =
      pathname === mod.ruta ||
      (mod.ruta !== "/dashboard" && pathname.startsWith(`${mod.ruta}/`));

    const coincideSecundaria = mod.rutasSecundarias?.some((sec) =>
      pathname.startsWith(sec)
    );

    if (coincideRuta || coincideSecundaria) {
      return modulosPermitidos.includes(mod.id);
    }
  }

  // Si es /dashboard exacto
  if (pathname === "/dashboard") {
    return modulosPermitidos.includes("dashboard");
  }

  return true;
}

/**
 * Encuentra la definición del módulo correspondiente a una ruta
 */
export function obtenerModuloPorRuta(pathname: string): ModuloDefinicion | undefined {
  return MODULOS_OPERATIVOS.find(
    (m) =>
      pathname === m.ruta ||
      (m.ruta !== "/dashboard" && pathname.startsWith(`${m.ruta}/`)) ||
      m.rutasSecundarias?.some((sec) => pathname.startsWith(sec))
  );
}
