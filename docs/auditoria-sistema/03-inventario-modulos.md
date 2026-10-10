# INFORME DE AUDITORÍA INTEGRAL DE SOFTWARE
## DOCUMENTO 03: INVENTARIO DE TODOS LOS MÓDULOS DEL SISTEMA

---

| Metadato | Detalle Técnico |
| :--- | :--- |
| **Documento** | 03 - Inventario Detallado y Estado Real de Módulos |
| **Sistema Auditado** | Sistema de Control de Asistencia Escolar Inteligente Multi-Colegio SaaS |
| **Total Módulos Auditados** | 28 módulos y capacidades analizadas en código fuente real |
| **Fecha de Auditoría** | Octubre de 2026 |

---

### RESUMEN DEL INVENTARIO GENERAL

| # | Módulo Analizado | Estado Real | Pantallas Principales | Endpoints Clave |
| :---: | :--- | :---: | :--- | :--- |
| 1 | Inicio de Sesión y Autenticación | **OPERATIVO** | pp/login/page.tsx | /api/login, /api/logout, /api/auth/sesion |
| 2 | Panel Principal (Dashboard) | **OPERATIVO** | pp/dashboard/page.tsx | /api/dashboard |
| 3 | Administración de Usuarios | **OPERATIVO** | pp/dashboard/usuarios/page.tsx | /api/usuarios |
| 4 | Roles y Permisos (RBAC) | **OPERATIVO** | pp/dashboard/layout.tsx | lib/auth.ts, lib/tenant.ts |
| 5 | Gestión de Estudiantes | **OPERATIVO** | pp/dashboard/estudiantes/page.tsx | /api/estudiantes, /api/estudiantes/importar |
| 6 | **Gestión de Docentes** | **NO IMPLEMENTADO** | Ninguna | Ninguno |
| 7 | Gestión de Padres / Familias | **OPERATIVO** | pp/dashboard/padres/page.tsx | /api/padres, /api/padres/generar-masivo |
| 8 | **Gestión de Aulas, Grados y Secciones** | **PARCIAL / NO ENTIDAD** | Campos libres en Estudiantes | Campos de texto en /api/estudiantes |
| 9 | **Gestión de Matrículas** | **NO IMPLEMENTADO** | Ninguna | Ninguno |
| 10 | **Gestión de Horarios** | **PARCIAL / TURNOS** | pp/dashboard/turnos/page.tsx | /api/turnos |
| 11 | Registro de Asistencia (Quiosco) | **OPERATIVO** | pp/marcar/page.tsx | /api/asistencias, /api/asistencias/foto |
| 12 | Control de Tardanzas | **OPERATIVO** | pp/dashboard/tardanzas/page.tsx | /api/tardanzas |
| 13 | **Justificación de Inasistencias** | **PARCIAL / RETIROS** | Solo en Salidas Excepcionales | No existe justificativo de faltas completas |
| 14 | Salidas Excepcionales | **OPERATIVO** | pp/dashboard/salidas/page.tsx | /api/salidas-excepcionales |
| 15 | Control de Estudiantes Ausentes | **OPERATIVO** | pp/dashboard/ausentes/page.tsx | /api/ausentes |
| 16 | Reportes y Exportación | **OPERATIVO** | pp/dashboard/reportes-mensuales/page.tsx | /api/reportes/mensual, /api/reportes/estudiante |
| 17 | Notificaciones Omnicanal | **OPERATIVO** | Segundo plano en servicios | lib/telegram.ts, services/whatsapp.ts |
| 18 | Portal Web para Padres | **OPERATIVO** | pp/portal-padres/page.tsx | /api/portal-padres/login, /api/portal-padres/datos |
| 19 | Biometría Facial (AWS Rekognition) | **OPERATIVO** | En quiosco pp/marcar/page.tsx | /api/biometria/reconocer, /api/biometria/estudiantes |
| 20 | **Biometría por Huella Digital** | **NO IMPLEMENTADO** | Ninguna | Ninguno |
| 21 | Tareas Programadas / Cron Jobs | **OPERATIVO** | pp/dashboard/automatizaciones/page.tsx| /api/cron/automatizaciones, /api/alertas/ausentes |
| 22 | SuperMotor y Control de Jornada | **OPERATIVO** | pp/dashboard/supermotor/page.tsx | /api/supermotor, lib/supermotor.ts |
| 23 | Monitoreo y Salud del Sistema | **OPERATIVO** | pp/dashboard/monitoreo/page.tsx | /api/health, lib/health.ts |
| 24 | IA de Riesgo Escolar (Groq LLaMA) | **OPERATIVO** | pp/dashboard/inteligencia/page.tsx | /api/ia/riesgo-estudiante, /api/inteligencia-institucional |
| 25 | Calendario Escolar (Días no lectivos)| **OPERATIVO** | pp/dashboard/calendario/page.tsx | /api/calendario-escolar |
| 26 | Auditoría y Trazabilidad | **OPERATIVO** | pp/dashboard/auditoria/page.tsx | /api/auditoria, lib/auditoria.ts |
| 27 | Terminales Kiosco Autorizadas | **OPERATIVO** | En quiosco pp/marcar/page.tsx | /api/terminales, lib/terminal-auth.ts |
| 28 | **Backup y Restauración** | **PARCIAL / RIESGOSO** | pp/dashboard/backup/page.tsx | /api/backup, /api/backup/restaurar |

---


## 2. Fichas T�cnicas Exhaustivas por M�dulo Implementado

### M�dulo 01: Autenticaci�n Administrativa y Sesiones
- **Nombre:** Autenticaci�n Administrativa y Sesiones
- **Objetivo:** Controlar el acceso seguro del personal escolar y superadministradores al panel directivo mediante credenciales encriptadas y sesiones JWT firmadas.
- **Funcionalidades:** Login con correo y contrase�a, validaci�n de hash bcrypt, generaci�n de cookie HttpOnly `sesion_santa_rita`, validaci�n de sesi�n activa (`/api/auth/me`) y cierre de sesi�n (`/api/auth/logout`).
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR, RECEPCION.
- **Pantallas Disponibles:** `app/login/page.tsx`.
- **Entradas y Salidas:** Entrada: JSON con email y password. Salida: Cookie JWT con payload (id, email, rol, colegioId, nombre) y redirecci�n al dashboard.
- **Procesos Internos:** Busca usuario en tabla `Usuario`, verifica estado `activo === true`, compara password con `bcrypt.compare`, firma token JWT usando `jose` con `JWT_SECRET` (expira en 8h), escribe cookie `sesion_santa_rita` (HttpOnly, SameSite=Lax, Secure en prod), registra evento en `Auditoria`.
- **Tablas Utilizadas:** `Usuario`, `Colegio`, `Auditoria`.
- **Endpoints:** `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Dependencias:** `lib/auth.ts`, `lib/auditoria.ts`, `proxy.ts`.
- **Validaciones:** Email con formato v�lido, contrase�a no vac�a, usuario activo, colegio activo.
- **Manejo de Errores:** Retorna HTTP 401 si credenciales no coinciden o usuario inactivo. Retorna HTTP 500 con log seguro sin filtrar stack trace.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 02: Portal P�blico de Familias y Apoderados
- **Nombre:** Portal P�blico de Familias y Apoderados
- **Objetivo:** Permitir que los padres de familia consulten el historial de asistencia, puntualidad y salidas de sus hijos sin requerir usuario corporativo.
- **Funcionalidades:** Ingreso mediante DNI del apoderado + C�digo de acceso generado por el colegio, visualizaci�n de lista de hijos vinculados, consulta de asistencias por mes/semana, descarga de reportes y estado de justificativos.
- **Usuarios Autorizados:** PADRE / APODERADO (Acceso p�blico con token familiar de 8 d�gitos).
- **Pantallas Disponibles:** `app/portal-padres/page.tsx`.
- **Entradas y Salidas:** Entrada: DNI y c�digo secreto del padre. Salida: Historial de asistencia, horas de entrada/salida y estado de puntualidad.
- **Procesos Internos:** Valida existencia de `PadreAcceso`, verifica estado activo, consulta los estudiantes vinculados en `EstudiantePadre`, obtiene los registros de `Asistencia` y `SalidaExcepcional` filtrados por estudiante y rango de fechas.
- **Tablas Utilizadas:** `PadreAcceso`, `EstudiantePadre`, `Estudiante`, `Asistencia`, `SalidaExcepcional`.
- **Endpoints:** `POST /api/portal-padres/login`, `GET /api/portal-padres/mis-hijos`, `GET /api/portal-padres/asistencia`.
- **Dependencias:** `lib/prisma.ts`.
- **Validaciones:** C�digo de padre vigente y activo, correspondencia exacta de DNI y colegio.
- **Manejo de Errores:** HTTP 401 si el c�digo es incorrecto o revocado.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 03: Registro de Asistencia en Kiosco Garita
- **Nombre:** Registro de Asistencia en Kiosco Garita
- **Objetivo:** Registro ultra-r�pido de entradas y salidas de estudiantes en porter�a escolar mediante escaneo de c�digo de barras / QR de carnet o DNI.
- **Funcionalidades:** Lectura f�sica con lector �ptico o teclado virtual, detecci�n autom�tica de jornada (Entrada vs Salida), clasificaci�n de puntualidad seg�n horarios de turno, feedback sonoro y visual (verde/rojo/amarillo), emisi�n de evento en tiempo real v�a SSE, y protecci�n contra doble marcaci�n accidental (debounce).
- **Usuarios Autorizados:** Operador de Garita / Terminal Kiosco autorizado v�a `TERMINAL_SECRET`.
- **Pantallas Disponibles:** `app/marcar/page.tsx`.
- **Entradas y Salidas:** Entrada: C�digo QR/DNI escaneado, timestamp de la m�quina y token de terminal. Salida: JSON con estado (PUNTUAL, TARDE, SALIDA_ANTICIPADA), nombre del alumno, aula y foto.
- **Procesos Internos:** Valida token de terminal `x-terminal-secret`. Busca estudiante en `Estudiante` por DNI/C�digo. Verifica que est� `activo: true`. Eval�a si existe asistencia previa en el d�a (si no hay, es ENTRADA; si hay entrada y no salida, eval�a si es SALIDA). Invoca `determinarEstadoAsistencia()` de `lib/horarios.ts` comparando con el turno asignado. Inserta o actualiza `Asistencia`. Emite evento al bus SSE `lib/sse-bus.ts`. Dispara en segundo plano la alerta por WhatsApp/notificaci�n si aplica.
- **Tablas Utilizadas:** `Estudiante`, `Turno`, `Asistencia`, `Terminal`, `Auditoria`.
- **Endpoints:** `POST /api/asistencia/registrar`.
- **Dependencias:** `lib/horarios.ts`, `lib/asistencia-service.ts`, `lib/sse-bus.ts`, `lib/terminal-auth.ts`.
- **Validaciones:** Alumno no duplicado en menos de 60 segundos (debounce en memoria y DB), alumno perteneciente al colegio activo, turno v�lido asignado.
- **Manejo de Errores:** Retorna HTTP 404 si el DNI no existe; HTTP 400 si el alumno est� inactivo; HTTP 429 si se detecta doble marcaci�n inmediata.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 04: Reconocimiento Facial Kiosco (Visi�n Artificial)
- **Nombre:** Reconocimiento Facial Kiosco
- **Objetivo:** Identificaci�n biom�trica sin contacto de estudiantes frente a c�mara web en garita mediante inteligencia artificial en la nube.
- **Funcionalidades:** Captura de frame de video en canvas HTML5, compresi�n a JPEG Base64, env�o a backend, comparaci�n vectorial con AWS Rekognition Collection, obtenci�n del DNI del alumno y disparo del registro de asistencia.
- **Usuarios Autorizados:** Operador de Garita / Kiosco.
- **Pantallas Disponibles:** `app/marcar/page.tsx` (Modo C�mara Facial).
- **Entradas y Salidas:** Entrada: Frame en base64 de la webcam. Salida: Identificaci�n del estudiante con porcentaje de confianza (>85%) y registro autom�tico.
- **Procesos Internos:** Backend invoca AWS Rekognition `SearchUsersByImageCommand` sobre la colecci�n del colegio. Si encuentra coincidencia con confianza suficiente, extrae el UserID (DNI), recupera al estudiante y ejecuta la l�gica de `lib/asistencia-service.ts`.
- **Tablas Utilizadas:** `Estudiante`, `Asistencia`, `Colegio`.
- **Endpoints:** `POST /api/ia/reconocimiento-facial`, `POST /api/fotos-referencia/subir`.
- **Dependencias:** AWS SDK v3, `lib/aws-rekognition.ts`.
- **Validaciones:** Umbral m�nimo de confianza (85%), un solo rostro detectado por cuadro.
- **Manejo de Errores:** Retorna HTTP 404 si el rostro no coincide; HTTP 400 si la imagen est� borrosa o vac�a. Fallback silencioso sin colapsar el kiosco.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 05: Monitor en Vivo de Garita (SSE Streaming)
- **Nombre:** Monitor en Vivo de Garita
- **Objetivo:** Visualizaci�n en tiempo real para directivos y coordinadores de las marcaciones que se realizan en porter�a en vivo sin necesidad de recargar la p�gina.
- **Funcionalidades:** Conexi�n persistente Server-Sent Events (SSE), recepci�n de eventos en tiempo real al registrarse entradas o salidas, tarjetas visuales con avatar del estudiante, estado de puntualidad, aula y hora exacta.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/monitoreo/page.tsx`.
- **Entradas y Salidas:** Entrada: Stream HTTP SSE continuo. Salida: Feeds en vivo de marcaciones con animaciones de entrada.
- **Procesos Internos:** Establece conexi�n SSE con `app/api/eventos/sse/route.ts`. El servidor suscribe al cliente en `lib/sse-bus.ts`. Cada vez que `POST /api/asistencia/registrar` procesa una marca, emite el payload al bus, distribuyendo el mensaje a todos los clientes conectados del mismo colegio.
- **Tablas Utilizadas:** Ninguna directa (lectura en streaming desde bus de eventos en memoria; fallback hist�rico a `Asistencia`).
- **Endpoints:** `GET /api/eventos/sse`.
- **Dependencias:** `lib/sse-bus.ts`, `lib/auth.ts`.
- **Validaciones:** Sesi�n de usuario v�lida y activa al iniciar la conexi�n.
- **Manejo de Errores:** Reintento autom�tico de reconexi�n con backoff exponencial en el frontend ante ca�das de red.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 06: Gesti�n de Estudiantes y Carnets QR
- **Nombre:** Gesti�n de Estudiantes y Carnets QR
- **Objetivo:** Administraci�n integral del padr�n estudiantil, datos biogr�ficos, turnos asignados, fotos de perfil y generaci�n e impresi�n masiva de carnets con c�digo QR/barras.
- **Funcionalidades:** Listado paginado con b�squeda por nombre, DNI, grado y secci�n; creaci�n, edici�n y desactivaci�n de alumnos; importaci�n masiva desde Excel/CSV; y exportaci�n e impresi�n de carnets con credencial escolar.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/estudiantes/page.tsx`.
- **Entradas y Salidas:** Entrada: Datos del alumno (DNI, nombres, apellidos, nivel, grado, secci�n, turnoId, foto). Salida: Registro en base de datos y PDF/vista de carnet con c�digo QR y c�digo de barras Code128.
- **Procesos Internos:** Valida l�mite de estudiantes seg�n el plan contratado por el colegio. Comprueba unicidad de DNI por colegio. Asigna turno por defecto si no se especifica. Genera hash QR codificado. Registra auditor�a.
- **Tablas Utilizadas:** `Estudiante`, `Turno`, `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/estudiantes`, `POST /api/estudiantes`, `GET /api/estudiantes/[id]`, `PUT /api/estudiantes/[id]`, `DELETE /api/estudiantes/[id]`, `POST /api/estudiantes/carga-masiva`, `GET /api/estudiantes/[id]/carnet`.
- **Dependencias:** `lib/prisma.ts`, `lib/auditoria.ts`.
- **Validaciones:** DNI num�rico (8 d�gitos), nombres y apellidos obligatorios, grado y secci�n no nulos, validaci�n de cuota del plan escolar.
- **Manejo de Errores:** HTTP 409 si el DNI ya existe; HTTP 403 si se excede el l�mite del plan; HTTP 400 en datos inv�lidos.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 07: Gesti�n de Familias y Apoderados
- **Nombre:** Gesti�n de Familias y Apoderados
- **Objetivo:** Registro de padres de familia y generaci�n de credenciales seguras de acceso para la consulta escolar.
- **Funcionalidades:** Vinculaci�n de apoderados con uno o m�ltiples estudiantes (hermanos), generaci�n y regeneraci�n de c�digos familiares de 8 d�gitos, env�o de credenciales por WhatsApp y gesti�n de tel�fonos de contacto.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/familias/page.tsx`.
- **Entradas y Salidas:** Entrada: DNI apoderado, nombres, parentesco, tel�fono, estudiantes a vincular. Salida: C�digo de acceso familiar generado y credenciales.
- **Procesos Internos:** Crea registro en `PadreAcceso`, asocia registros en `EstudiantePadre`, genera c�digo pseudo-aleatorio criptogr�fico no predecible, registra auditor�a institucional.
- **Tablas Utilizadas:** `PadreAcceso`, `EstudiantePadre`, `Estudiante`, `Auditoria`.
- **Endpoints:** `GET /api/padres`, `POST /api/padres`, `PUT /api/padres/[id]`, `POST /api/padres/[id]/regenerar`.
- **Dependencias:** `lib/prisma.ts`, `lib/auditoria.ts`.
- **Validaciones:** DNI apoderado �nico por colegio, al menos un hijo vinculado.
- **Manejo de Errores:** HTTP 409 si el apoderado ya est� registrado; HTTP 404 si el alumno no pertenece al colegio.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 08: Salidas Excepcionales y Retiros Anticipados
- **Nombre:** Salidas Excepcionales y Retiros Anticipados
- **Objetivo:** Autorizar y registrar salidas justificadas de estudiantes antes de la culminaci�n del horario de clases (por salud, citas m�dicas, urgencias familiares).
- **Funcionalidades:** Formulario de registro de salida con motivo, nombre y DNI del apoderado que retira, hora de salida, selector de autorizaci�n m�dica/direcci�n, y consulta inmediata en el kiosco de garita para permitir el egreso del alumno.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR, RECEPCION.
- **Pantallas Disponibles:** `app/dashboard/salidas-excepcionales/page.tsx`.
- **Entradas y Salidas:** Entrada: ID de estudiante, motivo, persona que retira, parentesco, DNI, observaciones. Salida: Ticket digital de autorizaci�n de retiro y actualizaci�n de estado en garita.
- **Procesos Internos:** Inserta registro en `SalidaExcepcional`, marca estado `AUTORIZADO`, si el estudiante ya registr� entrada, permite su salida en el kiosco sin catalogarla como fuga o infracci�n disciplinaria.
- **Tablas Utilizadas:** `SalidaExcepcional`, `Estudiante`, `Usuario`, `Auditoria`.
- **Endpoints:** `GET /api/salidas-excepcionales`, `POST /api/salidas-excepcionales`, `DELETE /api/salidas-excepcionales/[id]`.
- **Dependencias:** `lib/prisma.ts`, `lib/auditoria.ts`.
- **Validaciones:** Estudiante activo, fecha de salida correspondiente al d�a en curso, motivo no vac�o.
- **Manejo de Errores:** HTTP 400 si faltan campos obligatorios o el estudiante no existe.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 09: Turnos y Horarios Escolares Din�micos
- **Nombre:** Turnos y Horarios Escolares Din�micos
- **Objetivo:** Definici�n de bandas horarias de entrada, tolerancia, inicio de tardanza y salida para diferentes niveles (Inicial, Primaria, Secundaria, Ma�ana, Tarde).
- **Funcionalidades:** Creaci�n de turnos personalizados, configuraci�n de hora de entrada, minutos de tolerancia, hora m�xima de tardanza, hora regular de salida y d�as lectivos aplicables; asignaci�n por defecto a nuevos alumnos.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/turnos/page.tsx`.
- **Entradas y Salidas:** Entrada: Nombre del turno, horaEntrada, minutosTolerancia, horaInicioTardanza, horaSalida, esDefault. Salida: Registro de turno persistido.
- **Procesos Internos:** Modifica la tabla `Turno`. Al registrar asistencia, el motor de `lib/horarios.ts` consulta la configuraci�n de este turno para calcular en milisegundos si la marcaci�n es PUNTUAL, TARDE o FUERA_HORARIO.
- **Tablas Utilizadas:** `Turno`, `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/turnos`, `POST /api/turnos`, `PUT /api/turnos/[id]`, `DELETE /api/turnos/[id]`.
- **Dependencias:** `lib/horarios.ts`, `lib/prisma.ts`.
- **Validaciones:** Coherencia de horarios (hora de entrada anterior a hora de salida, tolerancia num�rica positiva).
- **Manejo de Errores:** HTTP 400 ante traslape absurdo o formato de hora no v�lido HH:mm.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 10: Alertas Autom�ticas y Cron de Inasistencias
- **Nombre:** Alertas Autom�ticas y Cron de Inasistencias
- **Objetivo:** Proceso en segundo plano que detecta a los estudiantes que no asistieron tras el cierre de tolerancia y genera notificaciones e inasistencias formales.
- **Funcionalidades:** Endpoint securizado para Vercel Cron, detecci�n de d�as lectivos y calendario escolar, evaluaci�n por turnos, creaci�n de registros INASISTENCIA e inserci�n en cola de mensajer�a para apoderados.
- **Usuarios Autorizados:** Servicio interno de cron / SUPERADMIN (manual de prueba).
- **Pantallas Disponibles:** Sin pantalla directa (administrado en `app/dashboard/configuracion/page.tsx` y monitoreado en logs).
- **Entradas y Salidas:** Entrada: Header `Authorization: Bearer CRON_SECRET`. Salida: JSON con resumen de inasistencias detectadas y notificaciones emitidas.
- **Procesos Internos:** Revisa `vercel.json` (0 6 * * 1-5). Verifica si el d�a actual es h�bil seg�n `CalendarioEscolar`. Obtiene todos los turnos cuyo horario de entrada + tolerancia ya venci�. Consulta estudiantes activos sin registro en `Asistencia` para la fecha actual. Crea registro con estado `FALTA` o encola alerta para WhatsApp.
- **Tablas Utilizadas:** `CalendarioEscolar`, `Turno`, `Estudiante`, `Asistencia`, `Notificacion`, `Auditoria`.
- **Endpoints:** `GET /api/cron/alertas-inasistencia`, `POST /api/cron/alertas-inasistencia`.
- **Dependencias:** `services/automatizaciones/procesarAlertas.ts`, `lib/prisma.ts`.
- **Validaciones:** Token `CRON_SECRET` obligatorio, d�a no feriado, proceso idempotente (no duplica inasistencias ya registradas).
- **Manejo de Errores:** HTTP 401 si no hay token; log de error detallado en auditor�a si falla el env�o de mensajer�a.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 11: Dashboard General y KPIs Institucionales
- **Nombre:** Dashboard General y KPIs Institucionales
- **Objetivo:** Vista panor�mica ejecutiva del estado de la instituci�n en el d�a en curso para directores y administradores.
- **Funcionalidades:** M�tricas de presentes, tardanzas, faltas, porcentaje de puntualidad global, distribuci�n por grados, gr�fico de concurrencia horaria y accesos directos de operaci�n.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/page.tsx`.
- **Entradas y Salidas:** Entrada: Cookie de sesi�n. Salida: KPIs agregados y gr�ficas interactivas.
- **Procesos Internos:** Invoca `/api/dashboard/stats`, ejecuta consultas agregadas `count` y `groupBy` sobre `Asistencia` y `Estudiante`, calcula ratios y porcentajes en backend y los entrega en una sola carga optimizada.
- **Tablas Utilizadas:** `Estudiante`, `Asistencia`, `SalidaExcepcional`, `Turno`.
- **Endpoints:** `GET /api/dashboard/stats`.
- **Dependencias:** `lib/prisma.ts`, `lib/auth.ts`.
- **Validaciones:** Filtrado estricto por `colegioId` de la sesi�n.
- **Manejo de Errores:** HTTP 500 con fallback a valores en 0 para evitar ca�da de interfaz.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 12: Reportes de Asistencia y Descarga Excel/PDF
- **Nombre:** Reportes de Asistencia y Descarga Excel/PDF
- **Objetivo:** Generaci�n y descarga de s�banas de asistencia filtradas para fines administrativos, supervisi�n de UGEL o archivo escolar.
- **Funcionalidades:** Filtrado multicriterio por fecha inicio/fin, nivel, grado, secci�n y estado; tabla visual con paginaci�n y exportaci�n de archivos XLSX (Excel) y PDF formal.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/reportes/page.tsx`.
- **Entradas y Salidas:** Entrada: Par�metros URL (fechaDesde, fechaHasta, grado, seccion, estado). Salida: JSON de datos tabulares o buffer binario para descarga de archivo.
- **Procesos Internos:** Consulta compleja en `Asistencia` con relaciones `estudiante` y `turno`. Aplica ordenamiento cronol�gico. Genera hojas de c�lculo con librer�a `xlsx`.
- **Tablas Utilizadas:** `Asistencia`, `Estudiante`, `Turno`.
- **Endpoints:** `GET /api/reportes/asistencia`, `GET /api/reportes/asistencia/exportar`.
- **Dependencias:** `lib/prisma.ts`, `xlsx`.
- **Validaciones:** Rango de fechas coherente (m�ximo 90 d�as por consulta para proteger la memoria del servidor).
- **Manejo de Errores:** HTTP 400 si las fechas son inv�lidas; HTTP 404 si no hay registros en el rango.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 13: Reportes de Inasistencias y Faltas Cr�ticas
- **Nombre:** Reportes de Inasistencias y Faltas Cr�ticas
- **Objetivo:** An�lisis espec�fico de absentismo escolar para identificar estudiantes con faltas reiteradas o riesgo de abandono.
- **Funcionalidades:** Lista de inasistencias por per�odo, c�lculo de porcentaje de inasistencia por alumno, filtro por grados con mayor absentismo, discriminaci�n de justificaciones y exportaci�n de reportes disciplinarios.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR, COORDINADOR.
- **Pantallas Disponibles:** `app/dashboard/reportes/inasistencias/page.tsx`.
- **Entradas y Salidas:** Entrada: Rango de fechas y filtros de aula. Salida: Reporte de estudiantes con mayor n�mero de inasistencias acumuladas.
- **Procesos Internos:** Cruza d�as h�biles del calendario escolar con asistencias registradas y total de matr�cula, identifica ausencias y genera el ranking de faltas.
- **Tablas Utilizadas:** `Asistencia`, `Estudiante`, `CalendarioEscolar`.
- **Endpoints:** `GET /api/reportes/inasistencias`.
- **Dependencias:** `lib/prisma.ts`.
- **Validaciones:** Consideraci�n estricta de d�as feriados para no catalogar d�as no lectivos como inasistencias.
- **Manejo de Errores:** HTTP 400 ante par�metros incompletos.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 14: Detecci�n Temprana de Deserci�n con IA
- **Nombre:** Detecci�n Temprana de Deserci�n con IA
- **Objetivo:** Detecci�n predictiva de riesgo de abandono escolar analizando patrones de asistencia y tardanzas mediante modelos de lenguaje (LLM).
- **Funcionalidades:** C�lculo de score de riesgo (Bajo, Medio, Alto, Cr�tico) combinando reglas heur�sticas y evaluaci�n contextual con Groq (LLaMA-3.3-70b-versatile); recomendaciones pedag�gicas personalizadas.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/inteligencia-asistencia/page.tsx`.
- **Entradas y Salidas:** Entrada: ID de estudiante o aula completa. Salida: Nivel de riesgo, desglose de factores cr�ticos y sugerencias de acci�n para tutor�a escolar.
- **Procesos Internos:** Extrae los �ltimos 60 d�as de historial de `Asistencia` del alumno. Calcula porcentaje de inasistencias y tardanzas. Env�a prompt estructurado a la API de Groq solicitando diagn�stico en JSON. Almacena o cachea el resultado.
- **Tablas Utilizadas:** `Estudiante`, `Asistencia`, `SalidaExcepcional`.
- **Endpoints:** `POST /api/ia/riesgo-estudiante`.
- **Dependencias:** `groq-sdk`, `lib/prisma.ts`.
- **Validaciones:** M�nimo de 10 d�as de historial registrado para generar diagn�stico confiable.
- **Manejo de Errores:** Si la API de Groq no responde o no hay cuota, conmuta autom�ticamente a motor heur�stico local basado en porcentaje matem�tico de faltas, garantizando disponibilidad 100%.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 15: Chatbot Asistente IA Institucional
- **Nombre:** Chatbot Asistente IA Institucional
- **Objetivo:** Asistente conversacional inteligente para responder consultas anal�ticas sobre asistencia, estad�sticas y normativas escolares a directivos y coordinadores.
- **Funcionalidades:** Interfaz de chat interactiva, comprensi�n en lenguaje natural, consulta din�mica a la base de datos de asistencia del d�a o semana, respuestas resumidas contextuales.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/asistente-ia/page.tsx`.
- **Entradas y Salidas:** Entrada: Pregunta del usuario (texto). Salida: Respuesta asistida por IA con datos contextualizados.
- **Procesos Internos:** Extrae contexto resumido de la instituci�n (total alumnos, asistencia hoy, faltas cr�ticas), env�a prompt de sistema con restricciones a la API de Groq o OpenAI, y retorna la respuesta en streaming o bloque �nico.
- **Tablas Utilizadas:** `Asistencia`, `Estudiante`, `Colegio`.
- **Endpoints:** `POST /api/ia/chat-asistencia`.
- **Dependencias:** `groq-sdk`, `lib/prisma.ts`.
- **Validaciones:** Filtrado de prompt injection, validaci�n de colegio de la sesi�n.
- **Manejo de Errores:** HTTP 500 con mensaje amigable ante fallo de API externa o timeout.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 16: Panel Multisede / Superadmin de Colegios
- **Nombre:** Panel Multisede / Superadmin de Colegios
- **Objetivo:** Administraci�n centralizada de las instituciones educativas clientes (inquilinos SaaS), l�mites de cuota, planes y estado de suscripci�n.
- **Funcionalidades:** Creaci�n de nuevos colegios, configuraci�n del slug �nico y c�digo institucional, asignaci�n del plan (BASIC, PRO, ENTERPRISE), l�mite m�ximo de estudiantes permitidos (`limiteEstudiantes`), y activaci�n/suspensi�n de colegios.
- **Usuarios Autorizados:** SUPERADMIN exclusivamente.
- **Pantallas Disponibles:** `app/dashboard/colegios/page.tsx`.
- **Entradas y Salidas:** Entrada: Nombre de colegio, c�digo �nico, slug, plan, l�mite de alumnos, contacto. Salida: Registro en tabla Colegio y creaci�n de usuario admin inicial.
- **Procesos Internos:** Verifica unicidad de slug y c�digo institucional. Inserta registro en `Colegio`. Crea el turno por defecto (Ma�ana) y el usuario administrador inicial. Registra trazabilidad en auditor�a.
- **Tablas Utilizadas:** `Colegio`, `Usuario`, `Turno`, `Auditoria`.
- **Endpoints:** `GET /api/colegios`, `POST /api/colegios`, `PUT /api/colegios/[id]`.
- **Dependencias:** `lib/prisma.ts`, `lib/auth.ts`.
- **Validaciones:** Slug alfanum�rico sin espacios, c�digo �nico no repetido, l�mite de alumnos entero positivo.
- **Manejo de Errores:** HTTP 409 si el slug o c�digo ya existen; HTTP 403 si el usuario no es SUPERADMIN.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 17: Gesti�n de Usuarios del Sistema y Roles
- **Nombre:** Gesti�n de Usuarios del Sistema y Roles
- **Objetivo:** Creaci�n y administraci�n de las cuentas de personal que acceden al panel de control administrativo y asignaci�n de privilegios de rol.
- **Funcionalidades:** Listado de usuarios por colegio, creaci�n de usuarios con contrase�a cifrada (bcrypt), asignaci�n de roles jer�rquicos (`SUPERADMIN`, `ADMIN_COLEGIO`, `DIRECTOR`, `COORDINADOR`, `RECEPCION`), activaci�n/desactivaci�n y reseteo de contrase�as.
- **Usuarios Autorizados:** SUPERADMIN (todos los colegios), ADMIN_COLEGIO (su propio colegio).
- **Pantallas Disponibles:** `app/dashboard/usuarios/page.tsx`.
- **Entradas y Salidas:** Entrada: Email, nombre, password inicial, rol, colegioId. Salida: Usuario registrado con password en hash.
- **Procesos Internos:** Comprueba que el email no est� registrado. Aplica hash con bcrypt (salt rounds = 10). Graba en tabla `Usuario`.
- **Tablas Utilizadas:** `Usuario`, `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/usuarios`, `POST /api/usuarios`, `PUT /api/usuarios/[id]`, `DELETE /api/usuarios/[id]`.
- **Dependencias:** `bcryptjs`, `lib/prisma.ts`, `lib/auditoria.ts`.
- **Validaciones:** Formato de email v�lido, longitud m�nima de password (8 caracteres), rol existente en enum.
- **Manejo de Errores:** HTTP 409 si el correo ya existe; HTTP 403 si un ADMIN_COLEGIO intenta crear un SUPERADMIN.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 18: Configuraci�n del Colegio y Par�metros Globales
- **Nombre:** Configuraci�n del Colegio y Par�metros Globales
- **Objetivo:** Personalizaci�n institucional, carga de logotipo, reloj escolar, zonas horarias y pol�ticas operativas.
- **Funcionalidades:** Edici�n del nombre visible del colegio, direcci�n, tel�fono, carga de logotipo escolar (almacenado o en Base64/S3), ajuste de zona horaria institucional (`America/Lima`) y tolerancias generales.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO.
- **Pantallas Disponibles:** `app/dashboard/configuracion/page.tsx`.
- **Entradas y Salidas:** Entrada: Datos de perfil escolar y archivo/url de logo. Salida: Registro actualizado en tabla Colegio.
- **Procesos Internos:** Valida sesi�n, actualiza campos en registro `Colegio`, propaga cambios que afectan el encabezado y reportes impresos.
- **Tablas Utilizadas:** `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/configuracion`, `PUT /api/configuracion`.
- **Dependencias:** `lib/prisma.ts`, `lib/auditoria.ts`.
- **Validaciones:** Campos no nulos, formato URL o archivo de imagen v�lido.
- **Manejo de Errores:** HTTP 400 ante payloads inv�lidos.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 19: Panel de Diagn�stico y Salud del Sistema
- **Nombre:** Panel de Diagn�stico y Salud del Sistema
- **Objetivo:** Monitoreo t�cnico de la infraestructura, latencia de base de datos, memoria del servidor, conectividad externa y variables de entorno cr�ticas.
- **Funcionalidades:** Ping a PostgreSQL con medici�n de latencia en milisegundos, estado del runtime Node.js, uso de memoria heap y rss, verificaci�n de variables de entorno cr�ticas y endpoint estandarizado para monitoreo externo (UptimeRobot).
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO (Vista web); P�blico securizado para ping health (`/api/health`).
- **Pantallas Disponibles:** `app/dashboard/diagnostico/page.tsx`.
- **Entradas y Salidas:** Entrada: Solicitud GET. Salida: JSON con status `healthy`, `degraded` o `down`, latencia DB en ms y uptime del proceso.
- **Procesos Internos:** Ejecuta `prisma.$queryRaw` (`SELECT 1`) midiendo tiempo transcurrido con `performance.now()`. Comprueba memoria con `process.memoryUsage()`.
- **Tablas Utilizadas:** Consulta directa a motor Postgres v�a Prisma.
- **Endpoints:** `GET /api/health`, `GET /api/diagnostico`.
- **Dependencias:** `lib/health.ts`, `lib/prisma.ts`.
- **Validaciones:** Manejo de excepciones para que nunca arroje ca�da fatal de la app.
- **Manejo de Errores:** Retorna HTTP 503 si la base de datos no responde, detallando el componente fallido.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 20: Panel de Integraciones Externas
- **Nombre:** Panel de Integraciones Externas
- **Objetivo:** Gesti�n y prueba de servicios de terceros (AWS Rekognition, Pasarelas de WhatsApp / Twilio, Servicios de Email).
- **Funcionalidades:** Verificaci�n de estado de credenciales de AWS, prueba de conectividad con Colecci�n facial, configuraci�n de tokens de API de WhatsApp y bot�n de prueba de env�o de mensaje.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO.
- **Pantallas Disponibles:** `app/dashboard/integraciones/page.tsx`.
- **Entradas y Salidas:** Entrada: Par�metros de prueba (tel�fono de prueba). Salida: Diagn�stico de conexi�n y resultado de entrega.
- **Procesos Internos:** Valida existencia de variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `WHATSAPP_API_KEY`. Emite llamadas de prueba no destructivas.
- **Tablas Utilizadas:** `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/integraciones`, `POST /api/integraciones/test-whatsapp`.
- **Dependencias:** AWS SDK, fetch API.
- **Validaciones:** Formato de tel�fono internacional (+51...).
- **Manejo de Errores:** Retorna mensaje claro de rechazo del proveedor sin quebrar el frontend.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 21: Panel Desarrollador y Acciones Destructivas
- **Nombre:** Panel Desarrollador y Acciones Destructivas
- **Objetivo:** Herramientas de depuraci�n t�cnica y reinicio controlado de datos para entornos de pruebas pre-producci�n.
- **Funcionalidades:** Bot�n de "Reiniciar Datos de Prueba", vaciado de tablas transaccionales, generaci�n de datos demo y visualizador de estado t�cnico.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO (En el c�digo actual accesible por ADMIN_COLEGIO).
- **Pantallas Disponibles:** `app/dashboard/desarrollador/page.tsx`.
- **Entradas y Salidas:** Entrada: Confirmaci�n con frase de seguridad. Salida: Resumen de filas eliminadas.
- **Procesos Internos:** Ejecuta `deleteMany()` sobre `Estudiante`, `Asistencia` y `Auditoria`.
- **Tablas Utilizadas:** `Estudiante`, `Asistencia`, `SalidaExcepcional`, `Auditoria`.
- **Endpoints:** `POST /api/desarrollador/reiniciar-sistema`.
- **Dependencias:** `lib/prisma.ts`, `lib/auth.ts`.
- **Validaciones:** Verificaci�n de frase de confirmaci�n en el cuerpo del request.
- **Manejo de Errores:** HTTP 400 si la frase no coincide.
- **Estado Real:** **OPERATIVO PERO CR�TICAMENTE VULNERABLE**. *Hallazgo de Auditor�a:* Ejecuta `prisma.estudiante.deleteMany()` sin cl�usula `where: { colegioId }`, borrando estudiantes de TODOS los colegios en la base de datos compartida y destruyendo la bit�cora inmutable de Auditor�a.
- **Riesgo:** **CR�TICO**.

---

### M�dulo 22: Logs del Servidor y Visor de Depuraci�n
- **Nombre:** Logs del Servidor y Visor de Depuraci�n
- **Objetivo:** Visualizaci�n en tiempo real de trazas de eventos, errores capturados y registros del ciclo de vida de la aplicaci�n.
- **Funcionalidades:** Visor web de consola de eventos con filtro por severidad (INFO, WARN, ERROR), b�squeda de texto en memoria y descarga de archivo de log.
- **Usuarios Autorizados:** SUPERADMIN.
- **Pantallas Disponibles:** `app/dashboard/logs/page.tsx`.
- **Entradas y Salidas:** Entrada: Filtro de nivel. Salida: Stream o arreglo de logs recientes.
- **Procesos Internos:** Consulta un buffer rotativo en memoria o la tabla de auditor�a filtrada por eventos t�cnicos del sistema.
- **Tablas Utilizadas:** `Auditoria`.
- **Endpoints:** `GET /api/logs`.
- **Dependencias:** Logger interno.
- **Validaciones:** Restricci�n estricta a SUPERADMIN.
- **Manejo de Errores:** HTTP 403 a usuarios no autorizados.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 23: Gesti�n de Notificaciones Autom�ticas
- **Nombre:** Gesti�n de Notificaciones Autom�ticas
- **Objetivo:** Configuraci�n de canales de comunicaci�n (WhatsApp, Email) y plantillas de mensaje para eventos escolares (Entrada puntual, tardanza, inasistencia, salida excepcional).
- **Funcionalidades:** Habilitaci�n/deshabilitaci�n por evento, edici�n de plantillas de texto con variables din�micas (`{nombre}`, `{hora}`, `{aula}`), selector de canal principal y pruebas de despacho.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/notificaciones/page.tsx`.
- **Entradas y Salidas:** Entrada: Configuraci�n de plantillas y flags booleanos de activaci�n. Salida: Persistencia de configuraci�n y cola de despacho.
- **Procesos Internos:** Almacena configuraci�n en base de datos. Es consultado por el servicio de asistencia para decidir si despacha mensajes a apoderados.
- **Tablas Utilizadas:** `Notificacion`, `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/notificaciones`, `POST /api/notificaciones`, `POST /api/notificaciones/test`.
- **Dependencias:** `lib/prisma.ts`.
- **Validaciones:** Variables de plantilla existentes y sintaxis correcta.
- **Manejo de Errores:** Reintento no bloqueante; la falla en notificaci�n no impide el registro de la asistencia f�sica en garita.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 24: Mensajer�a Directa a Familias
- **Nombre:** Mensajer�a Directa a Familias
- **Objetivo:** Emisi�n de comunicados extraordinarios o avisos urgentes a grupos de apoderados (por grado, secci�n o institucional).
- **Funcionalidades:** Redactor de comunicados, selector de destinatarios (Toda la instituci�n, Primaria, Secundaria, Aula espec�fica), previsualizaci�n del mensaje y bot�n de env�o masivo con barra de progreso.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/mensajeria/page.tsx`.
- **Entradas y Salidas:** Entrada: Texto del comunicado y filtro de aulas. Salida: Encolado de mensajes en la tabla de notificaciones.
- **Procesos Internos:** Obtiene la lista de tel�fonos de apoderados vinculados en `EstudiantePadre`, inserta los registros en `Notificacion` con estado `PENDIENTE` y dispara el procesador en background.
- **Tablas Utilizadas:** `PadreAcceso`, `EstudiantePadre`, `Estudiante`, `Notificacion`.
- **Endpoints:** `POST /api/mensajeria/enviar`.
- **Dependencias:** `lib/prisma.ts`, servicio de despacho.
- **Validaciones:** Mensaje no vac�o, existencia de destinatarios con tel�fono v�lido.
- **Manejo de Errores:** Registro de fallas individuales sin interrumpir el lote completo.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 25: Calendario Escolar y D�as No Lectivos
- **Nombre:** Calendario Escolar y D�as No Lectivos
- **Objetivo:** Registro de d�as feriados, vacaciones de medio a�o, capacitaciones docentes y suspensiones de clases para evitar c�mputo indebido de inasistencias.
- **Funcionalidades:** Calendario visual interactivo, marcado de fechas no lectivas con motivo (Feriado Nacional, D�a del Maestro, Suspensi�n Climatol�gica), y consulta autom�tica por los motores de cron y reportes.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/calendario/page.tsx`.
- **Entradas y Salidas:** Entrada: Fecha (YYYY-MM-DD), motivo, esFeriado (boolean). Salida: Registro en `CalendarioEscolar`.
- **Procesos Internos:** Al registrarse o consultarse asistencias y por el cron job, se verifica si la fecha actual est� en esta tabla. Si es d�a no lectivo, el cron suspende la generaci�n de inasistencias.
- **Tablas Utilizadas:** `CalendarioEscolar`, `Colegio`, `Auditoria`.
- **Endpoints:** `GET /api/calendario-escolar`, `POST /api/calendario-escolar`, `DELETE /api/calendario-escolar/[id]`.
- **Dependencias:** `lib/prisma.ts`, `lib/horarios.ts`.
- **Validaciones:** Formato de fecha ISO, descripci�n requerida.
- **Manejo de Errores:** HTTP 409 si la fecha ya est� marcada como no lectiva en el colegio.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 26: Auditor�a de Seguridad y Trazabilidad
- **Nombre:** Auditor�a de Seguridad y Trazabilidad
- **Objetivo:** Registro inmutable de cada acci�n administrativa, modificaci�n de datos, accesos y eventos sensibles para control interno y cumplimiento legal.
- **Funcionalidades:** Bit�cora hist�rica con filtros por usuario, acci�n (`LOGIN`, `CREAR_ESTUDIANTE`, `REGISTRO_ASISTENCIA`, etc.), IP origen, timestamp exacto y detalle de payload en JSON.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO, DIRECTOR.
- **Pantallas Disponibles:** `app/dashboard/auditoria/page.tsx`.
- **Entradas y Salidas:** Entrada: Consulta paginada con filtros. Salida: Lista cronol�gica inmutable de registros.
- **Procesos Internos:** Invocado transversalmente por todas las rutas API mediante `registrarAuditoria()` en `lib/auditoria.ts`. Inserta fila en tabla `Auditoria`.
- **Tablas Utilizadas:** `Auditoria`, `Usuario`, `Colegio`.
- **Endpoints:** `GET /api/auditoria`.
- **Dependencias:** `lib/auditoria.ts`, `lib/prisma.ts`.
- **Validaciones:** Ninguna operaci�n destructiva permitida desde la interfaz normal.
- **Manejo de Errores:** La auditor�a se ejecuta en bloques `try/catch` para que una falla en log no impida la transacci�n principal, pero emite alerta de consola.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 27: Terminales Kiosco Autorizadas
- **Nombre:** Terminales Kiosco Autorizadas
- **Objetivo:** Control de acceso f�sico y autenticaci�n de los dispositivos (laptops, PCs o tablets) autorizados para operar la pantalla de garita de marcaci�n.
- **Funcionalidades:** Generaci�n de tokens secretos por terminal (`TERMINAL_SECRET`), registro de nombre de garita (Puerta Principal, Puerta Secundaria), estado activo/revocado y validaci�n en cada escaneo.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO.
- **Pantallas Disponibles:** Configurable desde el panel; validado en `app/marcar/page.tsx`.
- **Entradas y Salidas:** Entrada: C�digo o token de terminal. Salida: Autorizaci�n de pantalla de garita.
- **Procesos Internos:** La API de registro de asistencia valida el header `x-terminal-secret` contra los secretos activos en la tabla `Terminal` o la variable de entorno institucional.
- **Tablas Utilizadas:** `Terminal`, `Colegio`.
- **Endpoints:** `GET /api/terminales`, `POST /api/terminales`, `PUT /api/terminales/[id]`.
- **Dependencias:** `lib/terminal-auth.ts`, `lib/prisma.ts`.
- **Validaciones:** Terminal con token v�lido y estado `activo: true`.
- **Manejo de Errores:** HTTP 401 Unauthorized si la terminal no est� autorizada.
- **Estado Real:** **OPERATIVO AL 100%**.

---

### M�dulo 28: Backup y Restauraci�n de Base de Datos
- **Nombre:** Backup y Restauraci�n de Base de Datos
- **Objetivo:** Generaci�n de copias de seguridad de datos en formato JSON descargable y restauraci�n del estado del sistema ante contingencias.
- **Funcionalidades:** Bot�n de "Generar Backup Completo", descarga de archivo JSON con volcado de tablas institucionales, y formulario para subir y restaurar un backup previo.
- **Usuarios Autorizados:** SUPERADMIN, ADMIN_COLEGIO.
- **Pantallas Disponibles:** `app/dashboard/backup/page.tsx`.
- **Entradas y Salidas:** Entrada: Solicitud de descarga / Archivo JSON de respaldo. Salida: Archivo .json con estructura de datos / Restauraci�n de filas.
- **Procesos Internos:** En backup: Consulta `findMany()` en varias entidades y genera JSON. En restaurar: Vence datos con `deleteMany()` e inserta los registros del archivo JSON en lotes.
- **Tablas Utilizadas:** Consulta parcial: `Colegio`, `Usuario`, `Turno`, `Estudiante`, `Asistencia`, `CalendarioEscolar`.
- **Endpoints:** `GET /api/backup`, `POST /api/backup/restaurar`.
- **Dependencias:** `lib/prisma.ts`, `lib/auth.ts`.
- **Validaciones:** Archivo con formato JSON v�lido y estructura reconocida.
- **Manejo de Errores:** Retorna HTTP 400 si el JSON est� corrupto.
- **Estado Real:** **PARCIAL Y DE ALTO RIESGO**. *Hallazgo de Auditor�a:* El proceso de backup omite las tablas `Terminal`, `SalidaExcepcional` y `EvidenciaFotografica`. Al restaurar, borra los datos existentes pero NO restaura estas 3 tablas, provocando p�rdida definitiva de informaci�n y riesgo de violaci�n de restricciones de llave for�nea.
- **Riesgo:** **ALTO**.

---

## 3. M�dulos Evaluados pero Ausentes o No Implementados en el C�digo Fuente Real

Conforme a las directrices de auditor�a estricta de no asumir funcionalidades inexistentes, se examin� exhaustivamente el repositorio en busca de los siguientes m�dulos:

| M�dulo Requerido | Estado en el C�digo Fuente | Evidencia T�cnica en el Repositorio | Consecuencia Operativa |
| :--- | :--- | :--- | :--- |
| **Gesti�n de Docentes** | **NO IMPLEMENTADO** | No existe modelo `Docente` en `prisma/schema.prisma`. No existen rutas bajo `app/dashboard/docentes` ni endpoints en `app/api/docentes`. Los �nicos usuarios son personal administrativo y familias. | El sistema no permite registrar asistencia, tardanzas ni asignaciones horarias del personal docente; est� 100% focalizado en estudiantes. |
| **Integraci�n Biometr�a por Huella Digital** | **NO IMPLEMENTADO** | No existen drivers WebUSB, SDKs de lectores dactilares (ZKTeco, DigitalPersona), librer�as biom�tricas ni campos de plantilla biom�trica (`template_huella`) en el esquema de base de datos. Solo existe biometr�a facial por AWS Rekognition. | Si la instituci�n desea control dactilar, requerir� desarrollo e integraci�n de hardware desde cero. |
| **Gesti�n de Matr�culas Formales y Legajos** | **NO IMPLEMENTADO** | No existe entidad `Matricula`, historial de a�os acad�micos, pagos, pensiones ni legajo documental del estudiante. Los alumnos se crean directamente en la tabla `Estudiante` con un grado y secci�n fijos en texto. | No hay control de ciclo lectivo multianual ni estados de matr�cula formal (solo flag booleano `activo`). |
| **Gesti�n de Aulas, Grados y Secciones como Entidades Relacionales** | **PARCIAL / NO ENTIDAD** | No existen tablas `Grado`, `Seccion` ni `Aula`. Los campos `grado` y `seccion` son cadenas de texto (`String`) libres almacenadas directamente en la tabla `Estudiante`. | Riesgo de inconsistencias por tipograf�a (ej. "1A", "1ro A", "Primero A"). Las aulas se agrupan mediante `SELECT DISTINCT grado, seccion FROM "Estudiante"`. |
| **Justificaci�n Formal de Inasistencias Pasadas** | **PARCIAL / INCOMPLETO** | No existe una entidad de justificativos m�dicos o permisos formales para faltas ocurridas en d�as previos. Solo existe la tabla `SalidaExcepcional` que ampara el retiro anticipado del alumno durante el d�a en curso. | Si un alumno falta un d�a entero por enfermedad, no existe en la base de datos un flujo para cambiar formalmente la falta a "FALTA JUSTIFICADA" con certificado adjunto. |
| **Gesti�n de Horarios por Asignatura / Curso** | **NO IMPLEMENTADO** | Solo existen turnos generales (`Turno` con hora de entrada, tolerancia y salida de la instituci�n). No existe malla curricular, asignaturas ni horarios por hora pedag�gica. | El sistema opera como control de acceso institucional perimetral (puerta de ingreso), no como control de asistencia intra-clase. |

---

## 4. Matriz de Conexi�n e Interdependencia entre M�dulos

El siguiente esquema describe c�mo se comunican operativamente los m�dulos entre s�:

```
[ M01 Autenticaci�n ] ----> Genera Cookie JWT ----> Protege [ M06 a M28 Paneles Dashboard ]
         �
[ M27 Terminales ] ----> Entrega Token Garita ----> Autoriza [ M03 Kiosco Garita ]
                                                                 �
                                                   +---------------------------+
                                                   ?                           ?
                                        [ Escaneo QR/C�digo ]        [ M04 Reconocimiento Facial ]
                                                   �                           �
                                                   +---------------------------+
                                                                 �
                                                                 ?
                                                  [ Valida M09 Turnos & Horarios ]
                                                                 �
                                                                 ?
                                                  [ Registra en DB Asistencia ]
                                                                 �
                                      +--------------------------+--------------------------+
                                      ?                          ?                          ?
                          [ M05 SSE Streaming ]       [ M10 Alertas & Cron ]     [ M08 Salidas Excepcionales ]
                                      �                          �                          �
                                      ?                          ?                          ?
                          [ Pantalla Monitoreo ]      [ M23 Notificaciones ]     [ Control en Puerta ]
                                                                 �
                                                                 ?
                                                      [ M02 Portal Familias ]
```
