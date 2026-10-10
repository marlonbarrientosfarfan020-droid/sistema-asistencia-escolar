# DOCUMENTO 06: AUDITOR�A DE REGLAS DE NEGOCIO Y PROCESOS ESCOLARES

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Identificador Tenant:** `SANTA_RITA_001`  
**Auditor Responsable:** Analista Senior de Sistemas y Experto en Procesos Institucionales  

---

## 1. Clasificaci�n Metodol�gica de las Reglas de Negocio

Para asegurar un informe t�cnico fidedigno y transparente, la auditor�a clasifica cada regla de negocio en tres categor�as rigurosas:
1. **IMPLEMENTADA Y OPERATIVA:** La regla est� codificada, probada y activa en el c�digo fuente actual.
2. **PARCIAL O AUSENTE:** La regla no existe en el c�digo o tiene vac�os l�gicos significativos.
3. **REQUIERE CONFIRMACI�N INSTITUCIONAL:** Reglas que dependen de los estatutos internos del colegio o normativas del Ministerio de Educaci�n (UGEL) y requieren parametrizaci�n formal por la direcci�n.

---

## 2. Matriz Exhaustiva de Reglas de Negocio

| Regla de Negocio Evaluada | Estado de Implementaci�n | Ubicaci�n en el C�digo | Comportamiento Real Verificado |
| :--- | :--- | :--- | :--- |
| **Control Anti-Duplicados en Garita** | **IMPLEMENTADA** | `lib/asistencia-service.ts` L84-L112 | Implementa doble protecci�n: debounce de 60 segundos por timestamp en memoria y restricci�n f�sica `@@unique([colegioId, estudianteId, fecha])` en base de datos. Si un alumno pasa dos veces su carnet seguidas, la segunda es rechazada con HTTP 429. |
| **C�lculo de Tardanzas con Tolerancia** | **IMPLEMENTADA** | `lib/horarios.ts` `determinarEstadoAsistencia()` | Si el alumno marca entre `horaEntrada` y `horaEntrada + minutosTolerancia`, se clasifica como **PUNTUAL**. Si marca despu�s de la tolerancia hasta `horaInicioTardanza`, se marca como **TARDE**. |
| **Tardanza Severa / Fuera de Horario** | **IMPLEMENTADA** | `lib/horarios.ts` | Si el estudiante marca posterior a `horaInicioTardanza`, el sistema lo clasifica como **TARDE_SEVERA** o **FUERA_HORARIO**, requiriendo justificaci�n de regencia. |
| **Detecci�n Autom�tica de Inasistencias** | **IMPLEMENTADA** | `services/automatizaciones/procesarAlertas.ts` | El cron job analiza los estudiantes activos sin marcaci�n tras cerrar el horario de tolerancia del turno y genera registros autom�ticos con estado **FALTA**. |
| **Respeto a D�as No Lectivos y Feriados** | **IMPLEMENTADA** | `app/api/cron/alertas-inasistencia/route.ts` | Antes de computar inasistencias, el sistema consulta la tabla `CalendarioEscolar`. Si la fecha est� marcada como feriado o suspensi�n, el proceso se detiene sin alterar los r�cords. |
| **Bloqueo a Estudiantes Retirados / Inactivos** | **IMPLEMENTADA** | `app/api/asistencia/registrar/route.ts` | Si un alumno tiene `activo === false`, el kiosco de garita emite sonido de rechazo, muestra tarjeta roja y no permite la entrada ni computa asistencia. |
| **Salida Anticipada no Autorizada** | **IMPLEMENTADA** | `lib/horarios.ts` y `lib/asistencia-service.ts` | Si un alumno registra salida antes de `turno.horaSalida` y no existe registro en `SalidaExcepcional`, el sistema marca **SALIDA_ANTICIPADA** en rojo en el monitor. |
| **Salida Justificada por Permiso** | **IMPLEMENTADA** | `app/api/salidas-excepcionales/route.ts` | Si regencia registra una autorizaci�n m�dica o familiar en `SalidaExcepcional`, el kiosco permite la salida y clasifica el evento como **SALIDA_JUSTIFICADA**. |
| **Control de Cuota por Plan Escolar** | **IMPLEMENTADA** | `app/api/estudiantes/route.ts` | Valida que `totalEstudiantes < limiteEstudiantes` del `Colegio`. Si se excede, impide la matr�cula con HTTP 403 Forbidden. |
| **Justificaci�n de Inasistencias Pasadas (Faltas)** | **AUSENTE** | `schema.prisma` | No existe modelo de Justificativos de Inasistencias pasadas ni carga de certificado m�dico para convertir una "FALTA" en "FALTA JUSTIFICADA" con auditor�a formal. |
| **Historial de Traslado de Secciones** | **AUSENTE** | `schema.prisma` | Al cambiar el grado o secci�n de un alumno, se sobrescribe el campo de texto en `Estudiante`. No queda historial de a qu� aula pertenec�a en meses previos. |
| **L�mite de Tardanzas Acumuladas para Suspensi�n** | **REQUIERE CONFIRMACI�N** | No implementado en c�digo | No existe l�gica autom�tica que suspenda al alumno tras 3 tardanzas acumuladas. Se emite reporte pero la sanci�n es manual. |
| **C�mputo de Horas Pedag�gicas Libres** | **REQUIERE CONFIRMACI�N** | No implementado en c�digo | El sistema asume que la jornada es continua de entrada a salida. No contempla salidas intermedias para refrigerio ni horas libres fuera del colegio. |
| **Diferenciaci�n de Turnos por Nivel Educativo** | **IMPLEMENTADA** | `Turno` vinculado a `Estudiante` | Cada alumno puede tener un turno distinto (Inicial: 08:30 a 12:30; Primaria: 07:45 a 14:00; Secundaria: 07:30 a 14:30). |

---

## 3. An�lisis Detallado de Reglas Cr�ticas

### 3.1 Algoritmo de Decisi�n de Jornada (Entrada vs Salida)
El sistema utiliza un algoritmo determinista para saber si un escaneo corresponde a una Entrada o una Salida:
```
1. Consulta: �Existe asistencia registrada para este estudiante en la fecha actual?
   - NO: Registrar como ENTRADA. Evaluar puntualidad con Turno.
   - S�:
     2. Consulta: �El registro existente ya tiene asignada 'horaSalida'?
        - S�: Rechazar marcaci�n. El estudiante ya complet� su ciclo diario (Entrada y Salida registradas).
        - NO: Registrar como SALIDA.
          3. Consulta: �Hora actual < Turno.horaSalida?
             - S�:
               4. �Existe SalidaExcepcional activa hoy?
                  - S�: Clasificar como SALIDA_JUSTIFICADA.
                  - NO: Clasificar como SALIDA_ANTICIPADA (Alerta).
             - NO: Clasificar como SALIDA_REGULAR.
```

### 3.2 Debounce y Protecci�n de Concurrencia
Para prevenir el problema habitual de alumnos que juegan con el carnet frente al lector o rebotes de escaneo:
1. **Debounce Local en Frontend:** La pantalla de quiosco ignora pulsaciones repetidas del mismo c�digo durante 5 segundos.
2. **Debounce en Backend:** La funci�n `lib/asistencia-service.ts` consulta el �ltimo registro del estudiante en el d�a. Si fue actualizado hace menos de 60 segundos, rechaza la operaci�n con c�digo HTTP 429 Too Many Requests y no escribe en la base de datos.

### 3.3 Consistencia entre Reportes y Registros F�sicos
- Los reportes de asistencia en `app/dashboard/reportes/page.tsx` consultan directamente la tabla transaccional `Asistencia`. No existen tablas intermedias de cach� que puedan desfasarse.
- Cuando un estudiante ingresa por garita, el reporte lo incluye en tiempo real inmediatamente despu�s del commit en PostgreSQL.
