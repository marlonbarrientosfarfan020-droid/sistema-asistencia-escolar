# INFORME DE AUDITORÍA INTEGRAL DE SOFTWARE
## DOCUMENTO 01: RESUMEN EJECUTIVO

---

| Metadato | Detalle Técnico |
| :--- | :--- |
| **Sistema Auditado** | Sistema de Control de Asistencia Escolar Inteligente Multi-Colegio SaaS |
| **Versión Inspeccionada** | 1.0 (Producción / Release Candidate) |
| **Institución de Referencia** | I.E.P. Santa Rita de Casia (SANTA_RITA_001) |
| **Zona Horaria del Sistema** | America/Lima (UTC-05:00) — Sincronización horaria estricta Perú |
| **Fecha de Auditoría** | Octubre de 2026 |
| **Tipo de Auditoría** | Auditoría Estática de Código Fuente, Arquitectura, Base de Datos, Procesos y Seguridad |
| **Alcance** | 100% de la base de código fuente, esquemas Prisma, APIs, vistas y configuraciones |
| **Modificación de Código** | 0 archivos modificados (Auditoría de solo lectura) |

---

### 1. PROPÓSITO DEL INFORME

El presente documento constituye el **Resumen Ejecutivo** de la auditoría integral realizada sobre el Sistema de Control de Asistencia Escolar Inteligente. El objetivo fundamental ha sido examinar exhaustivamente el código fuente real del proyecto, determinar su arquitectura subyacente, validar la interconexión entre módulos, auditar el esquema de persistencia, contrastar las reglas de negocio implementadas contra las requeridas institucionalmente, evaluar la postura de seguridad de la plataforma y entregar un diagnóstico honesto, técnico y libre de suposiciones.

Este informe ha sido redactado con un doble propósito comunicacional:
1. **Para Directivos Institucionales y Promotores Educativos:** Ofrece una explicación clara, comprensible y estratégica sobre el estado real de la plataforma, qué procesos resuelve eficazmente, qué riesgos existen y qué pasos deben seguirse para su consolidación.
2. **Para Ingenieros de Software y Equipos de Tecnología:** Provee referencias técnicas exactas (rutas de archivos, funciones, modelos, algoritmos y flujos de datos) que respaldan cada conclusión.

---

### 2. RESUMEN DE LA SITUACIÓN ACTUAL DEL SISTEMA

El sistema analizado es una plataforma web moderna desarrollada sobre el stack de última generación **Next.js 16 (App Router) con React 19, TypeScript y Tailwind CSS v4**, respaldada por **Prisma ORM y PostgreSQL (Neon Cloud)**, con capacidades avanzadas de **reconocimiento facial por IA (AWS Rekognition)**, **despacho omnicanal de alertas (Telegram y WhatsApp)**, **analítica predictiva de riesgo escolar (Groq SDK / LLaMA 3.1)** y un bus de eventos en tiempo real mediante **Server-Sent Events (SSE)**.

A nivel de concepción arquitectónica, el sistema posee un diseño robusto y ambicioso articulado en torno a un componente central denominado **SuperMotor Escolar** (lib/supermotor.ts y lib/supermotor-guard.ts), el cual actúa como un árbitro soberano de estado de jornada y un kill-switch de alta velocidad para activar o pausar módulos individuales sin reiniciar el servidor.

#### Calificación General de la Plataforma
- **Arquitectura y Diseño Base:** 8.5 / 10 (Excelente estructura modular, tipado estricto en TypeScript y desacoplamiento de servicios).
- **Funcionalidad de Marcación en Portería:** 9.0 / 10 (Rápida, soporte QR, DNI y biometría facial, control de ventanas de turno y protección anti doble-escaneo).
- **Modelo de Base de Datos:** 8.0 / 10 (20 modelos bien estructurados con restricciones compuestas e índices B-Tree, aunque con inconsistencias de integridad en entidades secundarias).
- **Reglas de Negocio de Asistencia:** 8.5 / 10 (Motor horario unificado para cálculo estricto en horario de Perú UTC-05:00).
- **Seguridad y Control de Acceso:** 6.5 / 10 (Autenticación JWT robusta con cookies HttpOnly en el backend, pero con vulnerabilidades críticas en endpoints de administración, ausencia de verificación criptográfica en el proxy perimetral y almacenamiento de credenciales en localStorage en el cliente).
- **Procesos de Respaldo y Continuidad:** 5.0 / 10 (El módulo de backup omite 3 entidades críticas y el endpoint de restauración elimina datos pero no los repone).

---

### 3. PRINCIPALES FORTALEZAS IDENTIFICADAS

1. **SuperMotor Escolar con Aislamiento de Fallas:**
   La implementación de lib/supermotor.ts y lib/supermotor-guard.ts garantiza que si un proveedor externo como Meta WhatsApp o Telegram Bot sufre una interrupción de servicio o latencia excesiva, la marcación de asistencia del estudiante se completa exitosamente en la base de datos sin retardar el flujo de la garita.
2. **Clasificador Horario Unificado y Estricto (Perú UTC-05:00):**
   A través de lib/clasificadorAsistencia.ts y lib/timezone.ts, el sistema centraliza la clasificación de los alumnos (PUNTUAL, TARDE, ESPERANDO_INGRESO, INGRESO_PENDIENTE, TARDANZA_SIN_INGRESO, AUSENTE_CONFIRMADO, TURNO_INACTIVO, NO_LECTIVO). Se garantiza coherencia matemática idéntica entre la API pública, el dashboard de dirección y el motor de alertas automáticas.
3. **Múltiples Métodos de Marcación en Garita:**
   La pantalla de quiosco (pp/marcar/page.tsx) soporta escaneo de credenciales QR mediante webcam (html5-qrcode), teclado numérico / código de barras DNI, y verificación biométrica facial mediante AWS Rekognition (lib/aws-rekognition.ts) con umbral de similitud configurable (>97%).
4. **Streaming en Tiempo Real Nativo (SSE):**
   El canal pp/api/realtime/events/route.ts permite que las marcaciones en garita se reflejen de inmediato en los paneles de dirección sin recargar la página y sin incurrir en costos de suscripción de servicios WebSockets de terceros.
5. **Inteligencia Artificial Predictiva Determinista:**
   En pp/api/ia/riesgo-estudiante/route.ts, el cálculo del índice de deserción se realiza mediante una fórmula matemática ponderada fija (70% ausencias, 25% tardanzas, 5% salidas incompletas) descontando días no lectivos del calendario oficial. El modelo LLaMA (Groq SDK) se utiliza exclusivamente para la redacción de diagnósticos preventivos y recomendaciones, impidiendo alucinaciones numéricas.

---

### 4. PRINCIPALES RIESGOS Y DEBILIDADES DETECTADAS

1. **Vulnerabilidad Crítica de Destrucción Masiva de Datos:**
   El endpoint pp/api/desarrollador/reiniciar-sistema/route.ts permite que un usuario con rol ADMIN o ADMIN_COLEGIO ejecute un vaciado total de la base de datos (deleteMany sobre Estudiante, Asistencia, Auditoria, etc.) enviando una frase de confirmación en texto plano, **sin validar el colegio asignado (colegioId)**. Esto permite que el administrador de una institución borre la información de todos los colegios de la base de datos compartida y destruye la bitácora inmutable de auditoría.
2. **Incompletitud Crítica del Módulo de Respaldo y Restauración:**
   El endpoint pp/api/backup/route.ts omite respaldar tres tablas críticas creadas en fases recientes: Terminal, SalidaExcepcional y EvidenciaFotografica. Asimismo, el endpoint de restauración (pp/api/backup/restaurar/route.ts) ejecuta un borrado transaccional masivo de datos pero no restaura estas entidades, lo que provocaría fallos de integridad referencial o pérdida irreparable de datos ante una contingencia.
3. **Módulos No Implementados Asumidos Comúnmente:**
   - **Gestión de Docentes:** NO EXISTE en el código. No hay modelos, controladores ni vistas para registro o control de profesores.
   - **Integración Biométrica con Huella Digital:** NO EXISTE. Solo se implementó biometría facial por AWS Rekognition.
   - **Gestión de Matrículas:** NO EXISTE. No hay proceso de inscripción ni matrícula formal; solo un CRUD de estudiantes.
   - **Gestión de Aulas, Grados y Secciones:** NO EXISTE como entidad relacional. Son cadenas de texto libre en la ficha del alumno.
   - **Justificación Formal de Inasistencias:** NO EXISTE un flujo de solicitud o justificación de faltas completas; solo existe el módulo de SalidaExcepcional para retiros autorizados en el transcurso del día.
4. **Inseguridad en el Perímetro del Cliente (Frontend State):**
   En pp/dashboard/layout.tsx, el rol y la sesión del usuario se consultan y persisten en localStorage. Un usuario malicioso puede modificar su rol a ADMIN en la consola de desarrollo del navegador para visualizar las opciones de menú administrativo en la interfaz (aunque las APIs del backend rebotarán las operaciones si no se cuenta con la cookie JWT correspondiente).
5. **Archivo Huérfano en Librerías Centrales:**
   El archivo lib/aws-reconocer.ts posee un tamaño de 0 bytes en el repositorio. Aunque no rompe la compilación, representa código muerto que debe ser limpiado.

---

### 5. MATRIZ RESUMEN DE HALLAZGOS POR CRITICIDAD

| Nivel de Riesgo | Cantidad | Descripción Principal |
| :---: | :---: | :--- |
| **CRÍTICO** | 2 | 1. Reinicio total de base de datos sin aislamiento multi-tenant y borrado de auditoría en /api/desarrollador/reiniciar-sistema.<br>2. Restauración de backup con eliminación destructiva sin restaurar entidades de salidas excepcionales y terminales. |
| **ALTO** | 3 | 1. Dependencia de localStorage para control de interfaz y roles en layout.tsx.<br>2. Omisión de tablas críticas en la generación de respaldos (Terminal, SalidaExcepcional, EvidenciaFotografica).<br>3. Falta de verificación criptográfica de JWT en el proxy perimetral proxy.ts. |
| **MEDIO** | 4 | 1. Ausencia de normalización para Grados, Secciones y Aulas (campos string libres).<br>2. Archivo huérfano vacío lib/aws-reconocer.ts.<br>3. Ausencia de limitación de tasa (*Rate Limiting*) en rutas de login.<br>4. Exposición de secretos en el archivo .env del entorno local de desarrollo. |
| **BAJO** | 3 | 1. Inexistencia de índices en campos de búsqueda libre de nombres.<br>2. Falta de paginación en endpoints de consulta masiva como /api/asistencias y /api/auditoria (limitado estáticamente a 100 registros).<br>3. Redundancia de campos de foto en Asistencia (otoUrl, otoEntrada, otoSalida vs tabla EvidenciaFotografica). |

---

### 6. RECOMENDACIÓN ESTRATÉGICA PARA LA ALTA DIRECCIÓN

El sistema cuenta con un **núcleo de asistencia escolar altamente funcional y listo para operación continua en garita y dirección**. Sin embargo, antes de proceder a comercializar la plataforma como un producto SaaS multi-institucional o escalar a múltiples sedes, es imperativo ejecutar un plan de estabilización enfocado en:

1. **Bloquear o restringir con credenciales de dos factores (2FA) o clave maestra de servidor el endpoint de reinicio de base de datos**, garantizando que nunca se elimine la tabla Auditoria ni datos de otros colegios.
2. **Actualizar el módulo de Backup y Restauración** para contemplar el 100% de los 20 modelos relacionales del esquema Prisma.
3. **Blindar la navegación del dashboard** validando el rol de usuario directamente desde el token de sesión devuelto por el servidor (/api/auth/sesion) en lugar de leerlo desde localStorage.
4. **Transparentar la ficha institucional de módulos**, informando con claridad que las funciones de docentes, huella digital y matrículas no forman parte del alcance de la versión 1.0.

---
*Fin del Documento 01: Resumen Ejecutivo.*
