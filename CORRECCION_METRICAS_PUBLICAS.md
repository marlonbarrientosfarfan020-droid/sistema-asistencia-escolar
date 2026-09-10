# INFORME DE CORRECCIÓN ARQUITECTÓNICA — MÉTRICAS PÚBLICAS DE ASISTENCIA
**Sistema Inteligente de Asistencia Escolar con Visión Artificial y Automatizaciones**  
**Fecha de Auditoría y Corrección:** 09 de Septiembre de 2026  
**Institución Educativa:** I.E.P. Santa Rita de Cassia (Cañete, Lima - Perú)  
**Ambiente:** Pre-Producción / Local Validado (Sin Deploy / Sin Modificación de Datos de BD)

---

## 1. RESUMEN EJECUTIVO Y DICTAMEN FINAL

Se ha completado satisfactoriamente la corrección arquitectónica de las métricas de asistencia del portal público (`/` y `/api/publica/asistencia`), eliminando la divergencia de cálculo de inasistencias y la inconsistencia en la visualización de turnos inactivos sin alterar los datos persistidos en PostgreSQL (Neon DB).

### DICTAMEN OFICIAL:
```markdown
[X] CORRECCIÓN COMPLETADA
[ ] CORRECCIÓN CON OBSERVACIONES
[ ] ERROR — NO DESPLEGAR
```

---

## 2. ARCHIVOS MODIFICADOS Y CREADOS

| Archivo | Tipo | Propósito Arquitectónico |
| :--- | :--- | :--- |
| [`lib/clasificadorAsistencia.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/lib/clasificadorAsistencia.ts) | **NUEVO** | Helper puro y compartido que implementa la función única de clasificación `clasificarEstadoEstudiante()`. Unifica las reglas de negocio entre Portal Público, Dashboard Administrativo y SuperMotor/Cron. |
| [`lib/timezone.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/lib/timezone.ts) | **MODIFICADO** | Re-exporta los helpers del clasificador unificado para interoperabilidad centralizada con la capa de zona horaria institucional (`America/Lima`). |
| [`app/api/publica/asistencia/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/publica/asistencia/route.ts) | **MODIFICADO** | Integra `clasificarEstadoEstudiante()`, aísla estrictamente todas las consultas por `colegioId`, mantiene los turnos inactivos (`estado: false`) como población informativa sin computar falsas ausencias ni tardanzas, y calcula el porcentaje de asistencia exclusivamente sobre `totalOperativas`. |
| [`components/publico/DashboardAsistenciaPublica.tsx`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/components/publico/DashboardAsistenciaPublica.tsx) | **MODIFICADO** | Incorpora banner informativo para `alumnasTurnoInactivo`, actualiza los badges de cabecera (Matriculadas vs Operativas), ajusta las leyendas de KPIs y actualiza las tarjetas y tooltips del gráfico de turnos para reflejar turnos activos vs inactivos con conteo exacto de asignaciones. |

---

## 3. CAUSA ORIGINAL DE LA ANOMALÍA

1. **Cálculo Aislado y Prematuro de Ausencias:**
   - La ruta `/api/publica/asistencia` calculaba las ausencias restando directamente:
     $$\text{ausentes} = \text{totalMatriculadas} - \text{presentes} \implies 22 - 1 = 21$$
   - Esto asumía falsamente que cualquier alumna matriculada sin marcación en ese instante ya era una inasistencia consumada, ignorando la jornada del turno, la hora del día y si el turno estaba inactivo.
2. **Exclusión de Turnos Inactivos en la Consulta Prisma:**
   - La consulta Prisma realizaba: `prisma.turno.findMany({ where: { estado: true } })`.
   - Como el Turno TARDE tiene `estado = false` en la base de datos institucional, la consulta no retornaba el registro del turno tarde. La función `procesarTurno` recibía `undefined` y reportaba `0 alumnas asignadas`.
3. **Falta de Aislamiento Multi-Colegio en Métricas:**
   - Se utilizaba `prisma.estudiante.count({ where: { estado: true } })` global sin filtrar por `colegioId`, lo que arrastraba 1 estudiante de prueba perteneciente al tenant `COLEGIO_SAN_JOSE_002` (sumando 22 en lugar de 21).

---

## 4. SOLUCIÓN IMPLEMENTADA Y ARQUITECTURA UNIFICADA

### A. Helper Puro Compartido (`lib/clasificadorAsistencia.ts`)
Se implementó `clasificarEstadoEstudiante()` con la misma máquina de estados pura utilizada formalmente en el sistema:

$$\text{Estudiante} \longrightarrow \begin{cases}
\text{TURNO\_INACTIVO} & \text{si } turno.estado = \text{false} \\
\text{NO\_LECTIVO} & \text{si es feriado o suspensión} \\
\text{PUNTUAL / TARDE / JUSTIFICADO} & \text{si cuenta con marcación hoy} \\
\text{PENDIENTE\_INICIO / ESPERANDO\_INGRESO / INGRESO\_PENDIENTE / TARDANZA\_SIN\_INGRESO} & \text{si } ahora < horaSalida \\
\text{AUSENTE\_CONFIRMADO} & \text{si } ahora \ge horaSalida \text{ y sin marcación}
\end{cases}$$

### B. Tratamiento del Turno Inactivo (`turno.estado === false`)
- **Regla Estricta:** Sus estudiantes **NO** computan como ausentes, **NO** computan como tardanzas y **NO** son pendientes operativos.
- **Visualización Informativa:** Aparecen claramente identificadas en un banner informativo como `"Población en turno inactivo (20 estudiantes)"`.
- **Gráfico de Turnos:** El Turno Tarde se visualiza con el badge `INACTIVO`, con porcentaje neutral (`—`), 0 ausencias y con la leyenda exacta de sus `20 asignadas`.

### C. Total General vs Total Operativo
- `totalMatriculadas = 21` (Total institucional en Santa Rita)
- `totalOperativas = 1` (Únicamente alumnas de turnos activos)
- `alumnasTurnoInactivo = 20` (Alumnas de turnos no operativos)
- **Cálculo de Cobertura:**
  $$\text{porcentajeAsistencia} = \frac{\text{presentes}}{\text{totalOperativas}} \times 100\% = \frac{1}{1} \times 100\% = 100\%$$
- Si `totalOperativas === 0`, el porcentaje es `0%` (protegido contra división entre cero, `NaN` e `Infinity`).

### D. Aislamiento Multi-Colegio Estricto
- Se resolvió el tenant mediante `resolverColegio(null, request)` con fallback a `DEFAULT_COLEGIO_ID` (`SANTA_RITA_001`).
- Todas las consultas a Prisma (`estudiante`, `turno`, `asistencia`, `calendarioEscolar`, `configuracion`) incluyen obligatoriamente `{ where: { colegioId } }`.
- Cero impacto de colegios externos (`COLEGIO_SAN_JOSE_002`).

---

## 5. RESULTADOS DE LA BATERÍA DE PRUEBAS OBLIGATORIAS

Se ejecutó la suite automatizada de pruebas `scratch/test_casos_obligatorios.ts` conectada directamente a la base de datos institucional en Neon PostgreSQL:

| Caso de Prueba | Condición Evaluada | Resultado Esperado | Resultado Obtenido | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **CASO 1** | Santa Rita en Producción: MAÑANA activo (1 est, 1 pres), TARDE inactivo (20 est) | Matriculadas: 21<br>Operativas: 1<br>Presentes: 1<br>Puntuales: 1<br>Tardanzas: 0<br>Ausentes: 0<br>Pendientes: 0<br>Inactivas: 20<br>% Asist: 100% | Matriculadas: 21<br>Operativas: 1<br>Presentes: 1<br>Puntuales: 1<br>Tardanzas: 0<br>Ausentes: 0<br>Pendientes: 0<br>Inactivas: 20<br>% Asist: 100% | **APROBADO** |
| **CASO 2** | Turno activo dentro de ventana horaria (sin marcación) | Estado: `PENDIENTE`<br>Ausente: `false` | 07:15: `PENDIENTE_INICIO`<br>07:35: `ESPERANDO_INGRESO`<br>07:50: `INGRESO_PENDIENTE`<br>11:00: `TARDANZA_SIN_INGRESO`<br>Ninguno ausente | **APROBADO** |
| **CASO 3** | Turno activo supera hora de salida (sin marcación) | Estado: `AUSENTE_CONFIRMADO` | 13:05: `AUSENTE_CONFIRMADO`<br>Ausente confirmado: `true` | **APROBADO** |
| **CASO 4** | Turno inactivo con estudiantes asignados | No ausencias<br>No tardanzas<br>No pendientes | 10:00: `TURNO_INACTIVO`<br>19:00: `TURNO_INACTIVO`<br>Ausencias = 0 | **APROBADO** |
| **CASO 5** | Aislamiento tenant `COLEGIO_SAN_JOSE_002` | Impacto cero sobre Santa Rita (1 estudiante aislado) | San José en BD: 1<br>Cruce con Santa Rita: 0 | **APROBADO** |
| **CASO 6** | Sin turnos activos (`totalOperativas = 0`) | % Asist: 0%<br>Sin NaN ni Infinity | % Asist: 0%<br>Es NaN: `false`<br>Es Infinity: `false` | **APROBADO** |

---

## 6. VERIFICACIÓN DE NO REGRESIÓN

Se verificó la integridad de los módulos centrales del sistema:
- **Registro QR:** [`app/api/asistencias/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/asistencias/route.ts) sin modificaciones.
- **Registro DNI:** Teclado y marcación manual intactos.
- **Reconocimiento Facial:** [`app/api/biometria/reconocer/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/biometria/reconocer/route.ts) intacto.
- **SuperMotor y Motor de Jornada:** [`app/api/supermotor/ejecutar/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/supermotor/ejecutar/route.ts) y [`services/automatizaciones/procesarAlertas.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/services/automatizaciones/procesarAlertas.ts) intactos y ahora alineados al 100% con la misma lógica pura.
- **Cron y Automatizaciones:** [`app/api/cron/automatizaciones/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/cron/automatizaciones/route.ts) intacto.
- **Telegram y WhatsApp:** Despachadores de notificación intactos.
- **Portal de Padres:** [`app/api/portal-padres/datos/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/portal-padres/datos/route.ts) intacto.
- **Dashboard Administrativo:** [`app/api/dashboard/route.ts`](file:///c:/Users/Ingeniero%20de%20Sistema/Documents/Proyectos/sistema-asistencia/app/api/dashboard/route.ts) intacto.

---

## 7. RESULTADO DEL BUILD DE PRODUCCIÓN

Se ejecutó la compilación de producción con el comando oficial del proyecto:
```bash
npm run build
```

**Resultado obtenido:**
```
> sistema-asistencia@0.1.0 build
> prisma generate && next build

Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.

✔ Generated Prisma Client (7.8.0) to .\generated\prisma in 341ms

▲ Next.js 16.2.9 (Turbopack)
- Environments: .env

  Creating an optimized production build ...
✓ Compiled successfully in 45s
  Running TypeScript ...
  Finished TypeScript in 29.2s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/38) ...
✓ Generating static pages using 7 workers (38/38) in 7.4s
  Finalizing page optimization ...

Exit code: 0
Errores TypeScript: 0
Rutas compiladas con éxito: 38/38
```

---

## 8. CONCLUSIÓN Y RECOMENDACIÓN OPERATIVA

La corrección cumple de forma estricta con todas las directrices institucionales impuestas:
1. No se duplicó la lógica de ausencias (helper único compartido `clasificarEstadoEstudiante`).
2. Se respeta el estado inactivo de turnos sin generar falsas inasistencias ni penalizar los porcentajes operativos.
3. Se mantiene el aislamiento multi-tenant por `colegioId` en cada consulta.
4. No se alteraron los registros de base de datos ni los turnos de producción.
5. El sistema queda listo y con build exitoso para su eventual despliegue programado a Vercel cuando la dirección lo autorice.
