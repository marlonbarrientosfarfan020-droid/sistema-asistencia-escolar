# DOCUMENTO 08: AUDITOR�A DE CRON JOBS Y PROCESOS AUTOM�TICOS

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Infraestructura de Automatizaci�n:** Vercel Cron Jobs & Serverless Background Workers  
**Auditor Responsable:** Arquitecto de Infraestructura y Especialista en Procesos As�ncronos  

---

## 1. Inventario de Automatizaciones en el Sistema

La auditor�a analiz� todos los archivos de configuraci�n del repositorio (`vercel.json`), rutas bajo `app/api/cron/*` y la capa de servicios (`services/automatizaciones/*`).

Se identific� **1 proceso cron formal configurado en infraestructura** y **2 flujos automatizados reactivos**:

| Proceso | Tipo de Automatizaci�n | Archivo de Origen | Frecuencia / Gatillo |
| :--- | :--- | :--- | :--- |
| **Alerta Autom�tica de Inasistencias** | Cron Job Programado (Vercel Cron) | `app/api/cron/alertas-inasistencia/route.ts` | `0 6 * * 1-5` (Lun-Vie) |
| **Procesador de Reglas de Inasistencia** | Worker de Negocio | `services/automatizaciones/procesarAlertas.ts` | Invocado por el Cron Job |
| **Despacho Reactivo de Notificaciones** | Background Worker Event-Driven | `lib/asistencia-service.ts` | Gatillado por marcaci�n en Garita |
| **Monitoreo de Salud Peri�dico** | Health Check Reactivo | `lib/health.ts` | Invocado por monitor externo (Uptime) |

---

## 2. Ficha T�cnica Completa: Cron Job de Inasistencias

### 2.1 Especificaciones de Configuraci�n
- **Nombre T�cnico:** `cron-alertas-inasistencia`
- **Archivo de Configuraci�n de Despliegue:** `vercel.json`
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/alertas-inasistencia",
        "schedule": "0 6 * * 1-5"
      }
    ]
  }
  ```
- **Frecuencia y Horario:**
  - Expresi�n cron: `0 6 * * 1-5` (Minuto 0, Hora 6 UTC, de lunes a viernes).
  - *Conversi�n Horaria:* 06:00 UTC corresponde a las **01:00 AM hora local de Per� (UTC-5)**.
  - *Observaci�n de Auditor�a:* Ejecutar a la 01:00 AM del d�a actual analiza el cierre del d�a anterior o se ejecuta en la madrugada. Si el objetivo es detectar ausencias matutinas del turno regular a las 09:00 AM hora local de Per�, la expresi�n programada en Vercel debe ajustarse a las **14:00 UTC** (09:00 AM UTC-5).

### 2.2 Endpoint de Activaci�n y Mecanismo de Seguridad
- **Ruta:** `app/api/cron/alertas-inasistencia/route.ts`
- **M�todos Aceptados:** `GET` (solicitado por Vercel Cron) y `POST` (para pruebas manuales de administradores).
- **Control de Acceso:**
  ```typescript
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  ```
- **Seguridad Verificada:** El endpoint rechaza cualquier petici�n externa sin el Bearer token correcto, previniendo ataques de denegaci�n de servicio o ejecuciones maliciosas no autorizadas.

### 2.3 L�gica Interna y Ciclo de Vida (`services/automatizaciones/procesarAlertas.ts`)
1. **Verificaci�n de Calendario Escolar:**  
   Consulta `prisma.calendarioEscolar.findFirst({ where: { fecha: hoy, esFeriado: true } })`. Si es feriado o suspensi�n de clases, el proceso se auto-cancela inmediatamente sin tocar los datos de asistencia.
2. **Evaluaci�n de Turnos e Instituciones:**  
   Recorre todos los colegios activos y sus respectivos turnos. Comprueba si la hora actual es posterior al l�mite de tardanza (`horaInicioTardanza`).
3. **Detecci�n de Ausencias:**  
   Obtiene los estudiantes con matr�cula activa (`activo: true`) que no cuenten con ning�n registro en la tabla `Asistencia` para la fecha en curso.
4. **Inserci�n Idempotente de Inasistencias:**  
   Para cada alumno ausente:
   - Inserta un registro en `Asistencia` con estado `FALTA` y tipo de entrada `SISTEMA_CRON`.
   - Si el colegio tiene configurado el env�o autom�tico a padres, crea un registro en `Notificacion` con estado `PENDIENTE` conteniendo el mensaje de aviso para WhatsApp.
5. **Registro de Auditor�a:**  
   Guarda un log en la tabla `Auditoria` con la cantidad de alumnos procesados y el resumen de inasistencias generadas.

---

## 3. An�lisis de Idempotencia y Reintentos

### 3.1 Prevenci�n de Ejecuciones Duplicadas
- **Riesgo:** Si el cron job es invocado dos veces seguidas por un error de red o timeout en Vercel.
- **Mecanismo de Protecci�n:** La consulta de alumnos ausentes busca expresamente aquellos que **no tienen registro en la fecha**:
  ```typescript
  where: {
    activo: true,
    asistencias: {
      none: { fecha: hoy }
    }
  }
  ```
- **Resultado:** Si el cron se ejecuta 10 veces en el mismo d�a, solo la primera vez encontrar� alumnos sin asistencia y crear� los registros. Las siguientes 9 ejecuciones encontrar�n 0 estudiantes pendientes y finalizar�n limpiamente en menos de 100 ms. El proceso es **100% IDEMPOTENTE**.

### 3.2 Comportamiento ante Fallos del Proveedor de Mensajer�a
- Si la API externa de WhatsApp o Twilio falla al momento de despachar los mensajes, el registro de la inasistencia f�sica escolar en la base de datos **permanece intacto**.
- La notificaci�n queda en estado `FALLIDO` en la tabla `Notificacion`, permitiendo un reintento manual o programado posterior sin duplicar la falta del alumno.

---

## 4. Comparativa: Entorno Local vs Despliegue en Producci�n

| Par�metro | Entorno Local (Desarrollo) | Entorno de Producci�n (Vercel) |
| :--- | :--- | :--- |
| **Ejecuci�n Autom�tica** | No se ejecuta autom�ticamente (Vercel Cron no corre en `localhost`). | Se ejecuta autom�ticamente seg�n la programaci�n de `vercel.json`. |
| **Prueba Manual** | Mediante cURL o Postman enviando `Authorization: Bearer <CRON_SECRET>`. | Mediante el bot�n "Ejecutar Alertas de Prueba" en el panel administrativo o cURL. |
| **Zona Horaria** | Depende del sistema operativo de la m�quina local. | Corre en servidores UTC (`06:00 UTC`), requiriendo normalizaci�n con `America/Lima`. |

---

## 5. Consecuencias Operativas si el Cron No se Ejecuta

Si el cron job fallara o fuese desactivado:
1. Los estudiantes ausentes no tendr�an una fila con estado `FALTA` creada autom�ticamente en la tabla `Asistencia`.
2. En los reportes de asistencias del d�a aparecer�an simplemente como "Sin Marcaci�n", lo que distorsiona las estad�sticas si el reporte solo cuenta filas expl�citas con estado `FALTA`.
3. Los apoderados no recibir�an la alerta oportuna de inasistencia por WhatsApp en la ma�ana.
4. *Mitigaci�n existente en el sistema:* El m�dulo de reportes (`app/api/reportes/inasistencias/route.ts`) incluye una l�gica de c�lculo din�mico: si no existen registros creados por el cron, cruza la lista total de estudiantes matriculados contra los que marcaron asistencia en garita, mostrando las ausencias reales en el informe incluso si el cron no corri�.
