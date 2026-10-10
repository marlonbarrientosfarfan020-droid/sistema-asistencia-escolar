# DOCUMENTO 10: MATRIZ DE HALLAZGOS T�CNICOS, DEFICIENCIAS Y PLAN DE MEJORAS

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Tipo de An�lisis:** Auditor�a Est�tica de C�digo Fuente y Arquitectura de Datos  
**Auditor Responsable:** Arquitecto de Software Senior y L�der T�cnico de Calidad  

---

## 1. Resumen Consolidado de Hallazgos

La auditor�a analiz� minuciosamente cada archivo TypeScript, TSX, rutas API, esquemas Prisma y dependencias. Se identificaron **8 hallazgos principales** clasificados por criticidad, con soluciones t�cnicas directas.

---

## 2. Fichas T�cnicas de Hallazgos y Mejoras

### Hallazgo 01: Vaciado Masivo Multi-Colegio en Endpoint de Desarrollador
- **Problema:** El endpoint de reinicio de datos borra estudiantes y asistencias de toda la base de datos sin filtrar por colegio.
- **M�dulo Afectado:** M�dulo 21: Desarrollador / Reinicio de Sistema.
- **Archivo y Funci�n:** `app/api/desarrollador/reiniciar-sistema/route.ts` -> `POST()`.
- **Evidencia T�cnica:**
  ```typescript
  await prisma.asistencia.deleteMany();
  await prisma.estudiante.deleteMany();
  await prisma.auditoria.deleteMany();
  ```
- **Consecuencia:** Un usuario con rol `ADMIN_COLEGIO` de un colegio particular puede vaciar accidentalmente los registros de todas las instituciones educativas de la plataforma SaaS y borrar la bit�cora de auditor�a.
- **Nivel de Riesgo:** **CR�TICO**.
- **Soluci�n Recomendada:**
  1. Deshabilitar la ruta en producci�n bloque�ndola con `if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Deshabilitado en producci�n' }, { status: 403 });`.
  2. En caso de requerirse en desarrollo, agregar el filtro `where: { colegioId: sesion.colegioId }`.
  3. Eliminar la instrucci�n que borra la tabla `Auditoria`.
- **Prioridad de Implementaci�n:** **P0 (Inmediata / Bloqueante)**.

---

### Hallazgo 02: Backup Incompleto con Destrucci�n de Datos en Restauraci�n
- **Problema:** La exportaci�n JSON omite tablas operativas cr�ticas (`Terminal`, `SalidaExcepcional`, `EvidenciaFotografica`). Al restaurar, el sistema borra todo y estas tablas se pierden para siempre.
- **M�dulo Afectado:** M�dulo 28: Backup y Restauraci�n.
- **Archivo y Funci�n:** `app/api/backup/route.ts` y `app/api/backup/restaurar/route.ts`.
- **Evidencia T�cnica:** El objeto de exportaci�n no incluye `prisma.terminal.findMany()`, `prisma.salidaExcepcional.findMany()` ni fotos de evidencia.
- **Consecuencia:** Si la instituci�n sufre una contingencia y restaura un backup, todos los permisos de salida de los estudiantes y los accesos de las terminales de garita desaparecen permanentemente.
- **Nivel de Riesgo:** **ALTO**.
- **Soluci�n Recomendada:** Actualizar la ruta para incluir las 20 entidades de la base de datos o implementar un mecanismo de volcado SQL nativo gestionado por Neon PostgreSQL.
- **Prioridad de Implementaci�n:** **P1 (Alta)**.

---

### Hallazgo 03: Almacenamiento de Rol en `localStorage` del Navegador
- **Problema:** El layout del cliente guarda y consulta el rol del usuario en el almacenamiento local del navegador para armar el men�.
- **M�dulo Afectado:** M�dulo 17: Gesti�n de Usuarios / Navegaci�n.
- **Archivo y Funci�n:** `app/dashboard/layout.tsx` L45.
- **Evidencia T�cnica:** `const rol = localStorage.getItem('rol');`.
- **Consecuencia:** Cualquier usuario puede modificar la clave `rol` en las herramientas de desarrollador y visualizar botones y enlaces reservados para Directores o Superadministradores.
- **Nivel de Riesgo:** **MEDIO**.
- **Soluci�n Recomendada:** Obtener el rol directamente en el componente de servidor (`Server Component`) a trav�s del token JWT de la cookie y pasar la lista de opciones de navegaci�n como props seguras.
- **Prioridad de Implementaci�n:** **P1 (Alta)**.

---

### Hallazgo 04: Verificaci�n Superficial de Sesi�n en el Edge (`proxy.ts`)
- **Problema:** En Next.js 16, la funci�n `proxy.ts` �nicamente comprueba si existe la cookie `sesion_santa_rita`, pero no valida la firma JWT en el edge.
- **M�dulo Afectado:** M�dulo 01: Autenticaci�n.
- **Archivo y Funci�n:** `proxy.ts` -> `export function proxy(request)`.
- **Evidencia T�cnica:** `const tieneCookie = request.cookies.has('sesion_santa_rita'); if (!tieneCookie) return NextResponse.redirect(...);`.
- **Consecuencia:** Una cookie inventada con texto basura pasa la barrera del proxy y llega hasta el componente de servidor antes de ser rechazada por el backend, consumiendo c�mputo innecesario en p�ginas protegidas.
- **Nivel de Riesgo:** **MEDIO**.
- **Soluci�n Recomendada:** Incorporar la verificaci�n de la firma del token mediante `jwtVerify()` de la librer�a `jose` directamente en `proxy.ts`.
- **Prioridad de Implementaci�n:** **P2 (Media)**.

---

### Hallazgo 05: Archivo Hu�rfano Vac�o en Repositorio (`lib/aws-reconocer.ts`)
- **Problema:** Existe un archivo de 0 bytes con nombre similar al m�dulo oficial de AWS.
- **M�dulo Afectado:** M�dulo 04: Biometr�a Facial.
- **Archivo:** `lib/aws-reconocer.ts` (0 bytes). El archivo real en uso es `lib/aws-rekognition.ts`.
- **Consecuencia:** Confusi�n en el mantenimiento del c�digo fuente y riesgo de importaciones err�neas por autocompletado en el IDE.
- **Nivel de Riesgo:** **BAJO**.
- **Soluci�n Recomendada:** Eliminar el archivo hu�rfano `lib/aws-reconocer.ts`.
- **Prioridad de Implementaci�n:** **P3 (Baja)**.

---

### Hallazgo 06: Desalineaci�n Horaria en Programaci�n del Cron Job
- **Problema:** La tarea en `vercel.json` est� configurada en `0 6 * * 1-5` (06:00 UTC = 01:00 AM Per�), lo que ejecuta la detecci�n de inasistencias en la madrugada antes de que los estudiantes hayan llegado a clases.
- **M�dulo Afectado:** M�dulo 10: Cron de Inasistencias.
- **Archivo y Funci�n:** `vercel.json` -> cron schedule.
- **Consecuencia:** Si el cron se dispara a la 01:00 AM, eval�a el turno de la ma�ana cuando a�n nadie ha tenido la oportunidad de ingresar, o no encuentra alumnos si eval�a la fecha presente antes del inicio de clases.
- **Nivel de Riesgo:** **MEDIO / OPERATIVO**.
- **Soluci�n Recomendada:** Modificar la expresi�n en `vercel.json` a `0 14 * * 1-5` (14:00 UTC = 09:00 AM en Per�), garantizando que se ejecute una vez culminada la tolerancia de ingreso del turno ma�ana.
- **Prioridad de Implementaci�n:** **P1 (Alta)**.

---

### Hallazgo 07: Ausencia de Entidades Relacionales para Aulas (Grados y Secciones)
- **Problema:** Los campos `grado` y `seccion` son cadenas de texto (`String`) libres en la tabla `Estudiante`.
- **M�dulo Afectado:** M�dulo 06: Estudiantes / M�dulo 12: Reportes.
- **Archivo:** `prisma/schema.prisma` modelo `Estudiante`.
- **Consecuencia:** Errores tipogr�ficos (ej. "1A", "1-A", "1ro A") fragmentan los filtros de reportes y dividen artificialmente a los estudiantes de la misma aula f�sica en grupos separados.
- **Nivel de Riesgo:** **MEDIO**.
- **Soluci�n Recomendada:** Crear los modelos `Grado` y `Seccion` en Prisma con clave for�nea hacia `Colegio`, y relacionar al estudiante mediante `seccionId`.
- **Prioridad de Implementaci�n:** **P2 (Media)**.

---

### Hallazgo 08: Falta de M�dulo para Justificaci�n Formal de Inasistencias Pasadas
- **Problema:** No existe flujo para justificar faltas de d�as anteriores con certificado m�dico adjunto. Solo existe `SalidaExcepcional` para el d�a en curso.
- **M�dulo Afectado:** M�dulo 13: Inasistencias.
- **Archivo:** `prisma/schema.prisma` y `app/dashboard/reportes/inasistencias/page.tsx`.
- **Consecuencia:** Si un alumno falta 3 d�as por salud y el apoderado entrega la constancia m�dica, la direcci�n no puede cambiar el estado de la falta en el sistema de manera formal ni adjuntar el comprobante en PDF.
- **Nivel de Riesgo:** **MEDIO / FUNCIONAL**.
- **Soluci�n Recomendada:** Crear la entidad `JustificacionInasistencia` con campos `fechaInicio`, `fechaFin`, `motivo`, `documentoUrl` y estado `APROBADO/PENDIENTE`.
- **Prioridad de Implementaci�n:** **P2 (Media)**.

---

## 3. Matriz Resumen de Prioridades

| ID | Hallazgo | Riesgo | Prioridad | Esfuerzo Estimado |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Vaciado sin tenant en `/api/desarrollador` | **CR�TICO** | **P0 (Inmediata)** | 1 hora |
| **02** | Backup incompleto y destructivo | **ALTO** | **P1 (Alta)** | 3 horas |
| **06** | Horario de Cron en Vercel (14:00 UTC) | **MEDIO** | **P1 (Alta)** | 15 minutos |
| **03** | Rol en `localStorage` en layout | **MEDIO** | **P1 (Alta)** | 2 horas |
| **04** | Verificaci�n JWT en `proxy.ts` | **MEDIO** | **P2 (Media)** | 2 horas |
| **07** | Normalizaci�n de Grados y Secciones | **MEDIO** | **P2 (Media)** | 1 jornada |
| **08** | M�dulo de Justificaci�n de Inasistencias | **MEDIO** | **P2 (Media)** | 2 jornadas |
| **05** | Limpieza de archivo hu�rfano `aws-reconocer.ts` | **BAJO** | **P3 (Baja)** | 5 minutos |
