# DOCUMENTO 04: FLUJO FUNCIONAL DE PRINCIPIO A FIN DEL SISTEMA

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Identificador Tenant Principal:** `SANTA_RITA_001`  
**Estado:** Documentaci�n T�cnica de Auditor�a  
**Fecha:** Octubre 2026  
**Auditor Responsable:** Arquitecto de Software Senior y Especialista en Auditor�a de Sistemas  

---

## 1. Prop�sito y Alcance del Flujo

Este documento reconstruye el ciclo de vida operativo y funcional completo del Sistema de Gesti�n de Asistencia, desde el momento en que un actor (Superadmin, Administrador, Operador de Garita, Docente/Coordinador o Padre de Familia) interact�a con la plataforma, hasta la ejecuci�n de procesos autom�ticos en segundo plano y el almacenamiento inmutable de datos en la base de datos PostgreSQL.

Cada etapa describe con exactitud el archivo de c�digo fuente, la funci�n ejecutada, los par�metros transmitidos, las validaciones aplicadas y el tratamiento ante excepciones o fallas.

---

## 2. Flujo 1: Ingreso al Sistema y Autenticaci�n de Usuarios

### 2.1 Petici�n de Inicio de Sesi�n
- **Actor:** Personal del Colegio (Superadmin, Director, Coordinador, Recepcionista).
- **Pantalla:** `app/login/page.tsx`.
- **Acci�n:** El usuario ingresa su correo electr�nico y contrase�a institucional en el formulario.
- **Ruta invocada:** `POST /api/auth/login` en `app/api/auth/login/route.ts`.

### 2.2 Validaci�n de Identidad y Criptograf�a
- **Funci�n responsable:** `POST` en `app/api/auth/login/route.ts`.
- **Paso a paso:**
  1. La API valida que `email` y `password` vengan presentes en el cuerpo JSON del request.
  2. Consulta la base de datos mediante Prisma:
     ```typescript
     const usuario = await prisma.usuario.findUnique({
       where: { email: body.email.toLowerCase().trim() },
       include: { colegio: true }
     });
     ```
  3. Si el usuario no existe o su campo `activo` es `false`, o si el colegio asociado tiene `activo === false`, retorna inmediatamente HTTP 401 Unauthorized sin revelar si el fallo fue por correo o contrase�a.
  4. Ejecuta comparaci�n criptogr�fica:
     ```typescript
     const coincide = await bcrypt.compare(body.password, usuario.password);
     ```
  5. Si el hash no coincide, registra intento fallido y retorna HTTP 401.

### 2.3 Generaci�n de Sesi�n y Token JWT
- **Funci�n responsable:** `crearTokenSesion()` en `lib/auth.ts`.
- **Paso a paso:**
  1. Construye el payload de la sesi�n con los datos esenciales:
     ```typescript
     {
       id: usuario.id,
       email: usuario.email,
       nombre: usuario.nombre,
       rol: usuario.rol,
       colegioId: usuario.colegioId
     }
     ```
  2. Firma el token utilizando la librer�a `jose` con el algoritmo `HS256` y la clave privada `process.env.JWT_SECRET`, estableciendo una expiraci�n fija de 8 horas.
  3. Adjunta la cookie HTTP a la respuesta:
     - Nombre: `sesion_santa_rita`
     - Flags: `HttpOnly: true`, `SameSite: 'lax'`, `Path: '/'`, `Secure: process.env.NODE_ENV === 'production'`.
  4. Emite registro de auditor�a invocando `registrarAuditoria()` en `lib/auditoria.ts` con acci�n `LOGIN_EXITOSO`.
  5. Responde al cliente con HTTP 200 y el objeto usuario (sin la contrase�a).

---

## 3. Flujo 2: Determinaci�n de Rol y Renderizado de M�dulos

### 3.1 Intercepci�n en el Enrutador y Middleware Proxy
- **Archivo responsable:** `proxy.ts` (reemplazo en Next.js 16 para el middleware tradicional).
- **Paso a paso:**
  1. Cuando el navegador solicita cualquier ruta bajo `/dashboard/*`, la funci�n `proxy(request)` verifica la existencia de la cookie `sesion_santa_rita`.
  2. Si la cookie no est� presente, redirige inmediatamente a `/login`.
  3. *Nota de Auditor�a:* `proxy.ts` en el c�digo actual solo valida la existencia de la cookie pero no verifica la firma criptogr�fica en el edge; la verificaci�n completa de firma y rol se ejecuta en el layout del servidor y en cada handler de API mediante `obtenerSesion()` de `lib/auth.ts`.

### 3.2 Renderizado del Men� seg�n Rol
- **Archivo responsable:** `app/dashboard/layout.tsx`.
- **Paso a paso:**
  1. El layout obtiene el rol del usuario autenticado.
  2. Filtra la barra lateral (`Sidebar`) con base en la matriz de acceso:
     - **SUPERADMIN:** Acceso a todos los 28 m�dulos, incluyendo `/dashboard/colegios` y selector de multi-inquilino.
     - **ADMIN_COLEGIO / DIRECTOR:** Acceso a Estudiantes, Familias, Asistencia, Monitoreo, Turnos, Reportes, Salidas Excepcionales, Notificaciones, Configuraci�n, IA.
     - **COORDINADOR:** Acceso a Estudiantes, Asistencia, Monitoreo, Reportes y Salidas Excepcionales.
     - **RECEPCION:** Acceso limitado a Kiosco de Marcaci�n, Salidas Excepcionales y Monitoreo b�sico.
  3. *Hallazgo de Auditor�a detectado:* El componente cliente de `Sidebar` almacena temporalmente el rol en `localStorage.getItem('rol')` para agilizar la renderizaci�n visual. Si un usuario altera este valor en DevTools, ver� opciones del men� directivo, pero si intenta hacer clic o invocar las APIs, el backend en `app/api/*` validar� el token JWT real y rechazar� la petici�n con HTTP 403.

---

## 4. Flujo 3: Registro y Padr�n de Estudiantes

### 4.1 Creaci�n Individual
- **Pantalla:** `app/dashboard/estudiantes/page.tsx`.
- **Ruta invocada:** `POST /api/estudiantes` en `app/api/estudiantes/route.ts`.
- **Paso a paso:**
  1. `obtenerSesion()` extrae el `colegioId` del token JWT.
  2. Consulta la tabla `Colegio` para verificar la cuota contratada:
     ```typescript
     const totalActual = await prisma.estudiante.count({ where: { colegioId } });
     if (totalActual >= colegio.limiteEstudiantes) {
       return NextResponse.json({ error: 'L�mite de alumnos alcanzado para su plan' }, { status: 403 });
     }
     ```
  3. Verifica que no exista otro alumno con el mismo DNI en el mismo colegio:
     ```typescript
     const existe = await prisma.estudiante.findUnique({
       where: { colegioId_dni: { colegioId, dni: body.dni } }
     });
     ```
  4. Si existe, retorna HTTP 409 Conflict.
  5. Inserta el registro en la tabla `Estudiante` con `activo: true` y asigna el `turnoId` especificado (o el turno por defecto de la instituci�n).
  6. Si se adjunta fotograf�a, genera el hash o URL de almacenamiento.
  7. Registra evento en `Auditoria` con acci�n `CREAR_ESTUDIANTE`.

### 4.2 Carga Masiva desde Hoja de C�lculo
- **Ruta invocada:** `POST /api/estudiantes/carga-masiva` en `app/api/estudiantes/carga-masiva/route.ts`.
- **Paso a paso:**
  1. Recibe archivo multipart o arreglo JSON con filas importadas de Excel.
  2. Valida cabeceras requeridas: `DNI`, `NOMBRES`, `APELLIDOS`, `NIVEL`, `GRADO`, `SECCION`.
  3. Ejecuta una transacci�n o bucle controlado verificando l�mites y evitando duplicados.
  4. Retorna el resumen del procesamiento: n�mero de alumnos creados con �xito y lista de filas rechazadas por inconsistencias.

---

## 5. Flujo 4: Registro de Asistencia en Garita (Ciclo Cr�tico del Negocio)

Este es el proceso central con mayor exigencia de rendimiento y concurrencia del sistema.

### 5.1 Captura del Identificador (C�digo QR, Barras o Rostro)
- **Pantalla:** `app/marcar/page.tsx` (Modo Quiosco en Pantalla Completa).
- **Dispositivo:** Lector �ptico l�ser USB emulando teclado f�sico, o webcam con captura facial autom�tica.
- **Paso a paso:**
  1. El lector lee el c�digo del carnet y env�a el DNI seguido de la tecla Enter.
  2. El frontend ejecuta un control de debounce inmediato: si el mismo DNI fue enviado en los �ltimos 5 segundos, ignora la lectura para evitar doble disparo por rebote del l�ser.
  3. El frontend emite la petici�n:
     ```http
     POST /api/asistencia/registrar
     Headers:
       Content-Type: application/json
       x-terminal-secret: <TOKEN_TERMINAL>
     Body:
       { "dni": "72849102", "timestampLocal": "2026-10-09T07:42:15-05:00" }
     ```

### 5.2 Autenticaci�n de Terminal y Validaci�n de Negocio en Backend
- **Archivo responsable:** `app/api/asistencia/registrar/route.ts` y `lib/asistencia-service.ts`.
- **Paso a paso:**
  1. **Validaci�n de Terminal:** Invoca `validarTerminal()` en `lib/terminal-auth.ts`. Comprueba que el header `x-terminal-secret` coincida con un registro activo en la tabla `Terminal` o con la variable de entorno del colegio.
  2. **B�squeda del Alumno:** Consulta en la base de datos:
     ```typescript
     const estudiante = await prisma.estudiante.findFirst({
       where: { dni: body.dni, colegioId, activo: true },
       include: { turno: true }
     });
     ```
     Si no existe o est� inactivo, retorna HTTP 404/400 con mensaje "Estudiante no registrado o retirado".
  3. **Control Anti-Duplicado (Debounce de Base de Datos):**
     Verifica si el alumno ya tiene un registro de asistencia en la fecha actual en los �ltimos 60 segundos:
     ```typescript
     const ultimaMarca = await prisma.asistencia.findFirst({
       where: { estudianteId: estudiante.id, fecha: hoy },
       orderBy: { updatedAt: 'desc' }
     });
     ```
     Si la diferencia entre la hora actual y la �ltima actualizaci�n es menor a 1 minuto, retorna HTTP 429 con mensaje "Marcaci�n duplicada detectada. Por favor espere".

### 5.3 Clasificaci�n Horaria de la Jornada
- **Funci�n responsable:** `determinarEstadoAsistencia()` en `lib/horarios.ts`.
- **Paso a paso:**
  1. Si el estudiante **NO tiene asistencia previa registrada en la fecha actual**:
     - Se clasifica como **EVENTO DE ENTRADA**.
     - Compara la hora actual (`HH:mm:ss`) con las reglas del `Turno` del estudiante:
       - Si `horaActual <= turno.horaEntrada + turno.minutosTolerancia`: Estado = **PUNTUAL**.
       - Si `turno.horaEntrada + tolerancia < horaActual <= turno.horaInicioTardanza`: Estado = **TARDE**.
       - Si `horaActual > turno.horaInicioTardanza`: Estado = **TARDE_SEVERA** o **FUERA_HORARIO** (seg�n configuraci�n).
     - Inserta el registro en la tabla `Asistencia`:
       ```typescript
       await prisma.asistencia.create({
         data: {
           colegioId,
           estudianteId: estudiante.id,
           fecha: hoy,
           horaEntrada: ahora,
           estado: estadoCalculado,
           tipoEntrada: 'KIOSCO_QR',
           terminalId: terminal.id
         }
       });
       ```
  2. Si el estudiante **YA tiene una Entrada registrada pero NO tiene Salida**:
     - Se clasifica como **EVENTO DE SALIDA**.
     - Comprueba si existe una salida excepcional autorizada en la tabla `SalidaExcepcional` para el d�a:
       - Si existe `SalidaExcepcional` con estado `AUTORIZADO`: Permite la salida y marca `SALIDA_JUSTIFICADA`.
       - Si la hora actual es anterior a `turno.horaSalida` y no hay autorizaci�n: Marca **SALIDA_ANTICIPADA**.
       - Si la hora actual es igual o posterior a `turno.horaSalida`: Marca **SALIDA_REGULAR**.
     - Actualiza el registro existente en `Asistencia`:
       ```typescript
       await prisma.asistencia.update({
         where: { id: asistenciaExistente.id },
         data: {
           horaSalida: ahora,
           estadoSalida: estadoSalidaCalculado
         }
       });
       ```

### 5.4 Emisi�n en Tiempo Real (SSE) y Notificaciones
- **Funciones responsables:** `emitirEvento()` en `lib/sse-bus.ts` y `despacharNotificacionAsistencia()` en segundo plano.
- **Paso a paso:**
  1. El servidor publica el evento en el bus de Server-Sent Events:
     ```typescript
     sseBus.emit(`colegio_${colegioId}`, {
       tipo: 'NUEVA_MARCACION',
       estudiante: {
         id: estudiante.id,
         nombre: `${estudiante.nombres} ${estudiante.apellidos}`,
         grado: estudiante.grado,
         seccion: estudiante.seccion,
         foto: estudiante.fotoUrl
       },
       evento: esEntrada ? 'ENTRADA' : 'SALIDA',
       estado: estadoCalculado,
       hora: ahora.toLocaleTimeString()
     });
     ```
  2. Todas las pantallas abiertas en `/dashboard/monitoreo` reciben el evento al milisegundo y muestran la tarjeta animada del alumno.
  3. Si el colegio tiene activadas las notificaciones inmediatas por WhatsApp, un worker as�ncrono no bloqueante encola el mensaje al apoderado registrado en `EstudiantePadre`.
  4. La API responde al Kiosco de Garita con HTTP 200, datos del alumno y c�digo de color para el feedback visual (Verde = Puntual, Amarillo = Tarde, Rojo = Salida no autorizada / Alumno inactivo).

---

## 6. Flujo 5: Detecci�n Autom�tica de Inasistencias y Cron Job

### 6.1 Disparo Programado
- **Programador:** Vercel Cron.
- **Expresi�n Cron:** `0 6 * * 1-5` (De lunes a viernes a las 06:00 UTC = 01:00 AM hora de Lima, o configurado seg�n corte de turno).
- **Ruta invocada:** `GET /api/cron/alertas-inasistencia` en `app/api/cron/alertas-inasistencia/route.ts`.

### 6.2 Verificaci�n de Condiciones de Activaci�n
- **Archivo responsable:** `services/automatizaciones/procesarAlertas.ts`.
- **Paso a paso:**
  1. Valida el header `Authorization: Bearer <CRON_SECRET>`. Si no coincide, aborta con HTTP 401.
  2. Consulta la tabla `CalendarioEscolar`:
     ```typescript
     const esFeriado = await prisma.calendarioEscolar.findFirst({
       where: { fecha: hoy, esFeriado: true }
     });
     ```
  3. Si la fecha actual est� marcada como feriado o d�a no lectivo, el cron finaliza inmediatamente con mensaje "D�a no lectivo: proceso suspendido".
  4. Itera sobre cada `Colegio` activo y cada `Turno` registrado.
  5. Determina si el turno ya cerr� su ventana de ingreso (hora actual > `turno.horaInicioTardanza`).
  6. Obtiene todos los estudiantes activos del turno que **NO tengan ning�n registro en la tabla `Asistencia`** para la fecha de hoy.
  7. Para cada estudiante ausente:
     - Crea un registro en la tabla `Asistencia` con estado:
       ```typescript
       {
         colegioId: colegio.id,
         estudianteId: estudiante.id,
         fecha: hoy,
         estado: 'FALTA',
         tipoEntrada: 'SISTEMA_CRON'
       }
       ```
     - Si el colegio tiene habilitada la alerta a apoderados, inserta una notificaci�n en la tabla `Notificacion` con estado `PENDIENTE` para despacho v�a WhatsApp/SMS.
  8. Registra la ejecuci�n en la tabla `Auditoria` con el n�mero total de inasistencias generadas.
  9. Retorna resumen JSON al servicio de cron.

---

## 7. Flujo 6: Consulta en el Portal P�blico de Familias

### 7.1 Acceso del Apoderado
- **Pantalla:** `app/portal-padres/page.tsx`.
- **Ruta invocada:** `POST /api/portal-padres/login` en `app/api/portal-padres/login/route.ts`.
- **Paso a paso:**
  1. El apoderado ingresa su n�mero de DNI y el c�digo de acceso secreto provisto por el colegio (c�digo alfanum�rico generado en el M�dulo 07).
  2. El backend busca en la tabla `PadreAcceso`:
     ```typescript
     const acceso = await prisma.padreAcceso.findFirst({
       where: { dni: body.dni, codigoAcceso: body.codigoAcceso, activo: true }
     });
     ```
  3. Si no coincide, retorna HTTP 401 "Credenciales familiares no v�lidas".
  4. Si coincide, genera una sesi�n de portal familiar y retorna la lista de hijos asociados mediante la relaci�n `EstudiantePadre`.

### 7.2 Visualizaci�n del Historial de Asistencia
- **Ruta invocada:** `GET /api/portal-padres/asistencia?estudianteId=...`.
- **Paso a paso:**
  1. Verifica que el estudiante pertenezca efectivamente a los hijos vinculados al `padreAccesoId` de la sesi�n.
  2. Consulta la tabla `Asistencia` filtrando por el mes o semana seleccionados.
  3. Consulta la tabla `SalidaExcepcional` para mostrar las autorizaciones concedidas.
  4. Entrega al frontend el historial estructurado con horas exactas, estado (Puntual, Tardanza, Falta, Salida Justificada) y observaciones.

---

## 8. Flujo 7: Manejo de Errores, Concurrencia y Fallos de Conexi�n

### 8.1 Fallo de Conexi�n en el Kiosco de Garita (Modo Offline / Red Inestable)
- El cliente en `app/marcar/page.tsx` almacena las lecturas en una cola en memoria local si la llamada HTTP a `/api/asistencia/registrar` falla con `NetworkError`.
- Al restablecerse la conexi�n, la cola despacha las marcaciones pendientes preservando el timestamp local original (`timestampLocal`).
- El backend eval�a el timestamp transmitido para clasificar la puntualidad con la hora real en que el alumno cruz� la garita, no con la hora en que el servidor recuper� internet.

### 8.2 Concurrencia en Marcaciones Masivas
- Durante el pico de entrada escolar (07:30 a 08:00 AM), m�ltiples terminales Kiosco env�an solicitudes concurrentes al backend.
- La base de datos PostgreSQL en Neon gestiona el bloqueo a nivel de fila y el �ndice �nico compuesto `[colegioId, estudianteId, fecha]` previene f�sicamente la inserci�n de dos registros de asistencia para el mismo alumno en el mismo d�a escolar.
- El debounce de 60 segundos en `lib/asistencia-service.ts` rechaza solicitudes duplicadas antes de intentar una escritura conflictiva en la base de datos.

### 8.3 Resumen de Trazabilidad por Archivo y Funci�n

| Fase del Flujo | Archivo Fuente Responsable | Funci�n Principal | Entidad BD Afectada |
| :--- | :--- | :--- | :--- |
| Login Administrativo | `app/api/auth/login/route.ts` | `POST()` / `bcrypt.compare` | `Usuario`, `Auditoria` |
| Verificaci�n JWT | `lib/auth.ts` | `obtenerSesion()` / `jwtVerify()` | Memoria / Cookie |
| Alta de Alumno | `app/api/estudiantes/route.ts` | `POST()` | `Estudiante`, `Auditoria` |
| Validaci�n Kiosco | `lib/terminal-auth.ts` | `validarTerminal()` | `Terminal` |
| Clasificaci�n Horaria | `lib/horarios.ts` | `determinarEstadoAsistencia()` | `Turno` (lectura) |
| Registro de Asistencia | `app/api/asistencia/registrar/route.ts` | `POST()` / `lib/asistencia-service.ts` | `Asistencia`, `Auditoria` |
| Difusi�n en Vivo | `lib/sse-bus.ts` | `sseBus.emit()` | Bus de Memoria SSE |
| Cron de Inasistencias | `services/automatizaciones/procesarAlertas.ts` | `procesarAlertasInasistencia()` | `Asistencia`, `Notificacion` |
| Consulta Familiar | `app/api/portal-padres/asistencia/route.ts` | `GET()` | `Asistencia`, `EstudiantePadre` |
