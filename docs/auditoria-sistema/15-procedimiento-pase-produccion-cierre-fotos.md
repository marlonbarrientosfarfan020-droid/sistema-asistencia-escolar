# PROCEDIMIENTO TÉCNICO DE PASE A PRODUCCIÓN
## CIERRE AUTOMÁTICO DE JORNADAS, FOTOGRAFÍAS ROTATIVAS Y PORTAL DE PADRES 24/7

**Institución:** I.E. Santa Rita de Jesús  
**Entorno de Producción:** Vercel Pro/Hobby + Neon PostgreSQL + Vercel Blob  
**Rama de Desarrollo:** `feature/terminal-v2-camara-qr`  
**Estado:** VALIDADO EN AISLAMIENTO — PENDIENTE DE AUTORIZACIÓN PARA PRODUCCIÓN  

---

## 1. RESUMEN EJECUTIVO Y DICTAMEN TÉCNICO

Tras la auditoría exhaustiva, la implementación modular y la ejecución exitosa de las pruebas integrales de 10 jornadas consecutivas en base de datos PostgreSQL aislada:

> **DICTAMEN: EL SISTEMA ESTÁ TÉCNICAMENTE APTO PARA DESPLIEGUE CONTROLADO.**
> No se ha ejecutado ninguna acción sobre Neon producción, ni modificado registros reales ni desplegado en Vercel.

---

## 2. VERIFICACIÓN DE LOS TRES OBJETIVOS PRINCIPALES

### 2.1 Cierre Automático Real de Jornadas
1. **Programación Vercel Cron:**
   - La configuración actual en `vercel.json` define:
     ```json
     {
       "crons": [
         {
           "path": "/api/cron/automatizaciones",
           "schedule": "0 6 * * 1-5"
         }
       ]
     }
     ```
   - El cron `0 6 * * 1-5` se dispara a las 06:00 UTC = 01:00 AM (hora Perú) de lunes a viernes.
   - Debido a que en Vercel Hobby las tareas cron se limitan a 1 ejecución por día, un cron a la 01:00 AM por sí solo no cerraría los turnos Mañana (14:00) y Tarde (19:30) en su hora exacta de culminación.
2. **Mecanismo Autónomo Multicapa (Sin Depender de Dashboard):**
   - **Capa 1 (Disparador Externo Gratuito - GitHub Actions):** Se incorporó el flujo programado `.github/workflows/cierre-jornadas.yml` que ejecuta peticiones seguras al endpoint institucional a las 14:15 Perú (Turno Mañana), 19:45 Perú (Turno Tarde) y 03:15 Perú (Turno Noche).
   - **Capa 2 (Cron Nativo Diario de Vercel):** Se integró `ejecutarCierreJornadasVencidas()` directamente dentro de `/api/cron/automatizaciones` para asegurar un barrido nocturno institucional incondicional a la 01:00 AM.
   - **Capa 3 (Cierre Oportunista en Tráfico Activo):** Los endpoints de alta frecuencia ejecutan el barrido asíncrono si detectan que un turno ha sobrepasado su `finPermitido`, sin añadir latencia al usuario ni requerir que un administrador abra el dashboard.
3. **Turnos Nocturnos que Cruzan Medianoche:**
   - Resuelto mediante `ventanaTurno.fechaBase`. Un turno 22:00 -> 02:00 que marca salida a la 01:00 AM o se barre a las 02:30 AM se vincula a la fecha del día de inicio, cerrando con `estadoJornada = "SIN_SALIDA"` sin confundir la jornada entrante.
4. **Seguridad del Endpoint `/api/cron/cierre-jornada`:**
   - Exige cabecera `Authorization: Bearer <CRON_SECRET>` con clave criptográfica >= 32 caracteres (validado por `esCronAutorizado`) o sesión con rol `ADMIN`/`DIRECTIVO`. Cualquier otra invocación es rechazada con `401 Unauthorized`.

---

### 2.2 Fotografías Rotativas y Almacenamiento Seguro
1. **Punteros Activos (`FotoActivaEstudiante`):**
   - Garantizan un máximo estricto de 1 foto activa de ENTRADA y 1 de SALIDA por estudiante y turno con restricción única `@@unique([estudianteId, turnoId, tipo])`.
2. **Protección Contra Subidas Tardías:**
   - Si se recibe una fotografía con fecha anterior a la del puntero activo actual (`fechaDia < puntero.fechaDia`), se registra en la asistencia correspondiente pero se marca como `esActiva = false`, impidiendo que sobreescriba la fotografía del día de hoy.
3. **Protección de Incidentes y Salidas Excepcionales:**
   - La función `protegerEvidenciaAsistencia()` marca permanentemente `fotoProtegida = true`, `esProtegida = true` y fija el estado de la cola en `CONSERVADO_POLITICA`.
4. **Eliminación Física Bloqueada en Producción:**
   - Salvaguarda rígida: a menos que la variable de entorno institucional sea explícitamente configurada como `POLITICA_PURGA_APROBADA="SI_CONFIRMADO"`, `procesarColaLimpiezaBlob()` opera en modo conservación incondicional. Ninguna de las 393 fotos de producción será borrada.
5. **Ofuscación y Etiqueta en Historial:**
   - En el Portal de Padres, las fotografías rotadas devuelven `fotoEntradaTexto: "Fotografía no conservada"` y el modal despliega la insignia institucional de conservación, respondiendo con `410 Gone` ante solicitudes directas por URL.

---

### 2.3 Portal de Padres 24/7
1. **Acceso Ininterrumpido:**
   - Las rutas del portal (`/api/portal-padres/login`, `/api/portal-padres/datos`) operan independientemente del estado del SuperMotor escolar.
   - Las familias pueden consultar registros a cualquier hora (11:00 p.m., domingos, feriados o vacaciones).
2. **Credenciales Familiares:**
   - Acceso seguro mediante DNI de la estudiante y contraseña del apoderado (`passwordHash`).
3. **Aislamiento Multiescolar Estricto:**
   - Las consultas filtran a nivel de base de datos por `codigoFamiliarId` y los IDs de estudiantes autorizados en la sesión. Un apoderado jamás puede ver información, asistencias ni fotografías de terceros.

---

## 3. MATRIZ DE COMPATIBILIDAD CON PRODUCCIÓN

Las tres migraciones acumuladas son **100% aditivas y libres de riesgo destructivo**:

| Migración | Objeto Afectado | Tipo de Operación | Impacto en Datos Existentes |
| :--- | :--- | :--- | :--- |
| `20261010_seguridad_portal_padres` | `CodigoFamiliar` | `ADD COLUMN IF NOT EXISTS` | Cero. Campos con defaults o nullables. |
| `20261011_idempotencia_persistente` | `RegistroIdempotencia` | `CREATE TABLE IF NOT EXISTS` | Cero. Tabla nueva para Vercel Serverless. |
| `20261011_fotos_rotativas_cierre_jornada` | `Asistencia`, `EvidenciaFotografica`, `FotoActivaEstudiante`, `ColaLimpiezaBlob` | `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` | Cero. Campos booleanos con defaults; tablas nuevas. |

**Garantías Confirmadas:**
- Los 204 estudiantes reales de producción no sufren ninguna modificación.
- No se regenera ningún código QR (los carnets impresos siguen 100% vigentes).
- Las 393 fotografías de evidencia en producción se mantienen intactas.
- El histórico de asistencias conserva todos sus datos de puntualidad y horas.

---

## 4. PROTOCOLO DE PUBLICACIÓN CONTROLADA (PASO A PASO)

### FASE 1: Respaldo Verificable Previo
1. En la consola de Neon PostgreSQL, crear un punto de restauración o branch de seguridad:
   - Nombre recomendado: `backup-pre-fase-cierre-fotos-20261011`.
2. Alternativamente, exportar un dump lógico del esquema y datos:
   ```bash
   pg_dump "$DATABASE_URL_NEON" -F c -b -v -f "backup_neon_20261011.dump"
   ```

### FASE 2: Aplicación de Migraciones Aditivas en Neon
Aplicar el script consolidado aditivo directamente sobre Neon:
- `prisma/migrations/20261010_seguridad_portal_padres/migration.sql`
- `prisma/migrations/20261011_idempotencia_persistente/migration.sql`
- `prisma/migrations/20261011_fotos_rotativas_cierre_jornada/migration.sql`

*(Al ser sentencias `IF NOT EXISTS`, la ejecución es idempotente y no bloquea las lecturas de los usuarios actuales).*

### FASE 3: Configuración de Variables en Vercel
En la consola de Vercel (Project Settings -> Environment Variables), verificar:
- `CRON_SECRET`: Cadena aleatoria de 32+ caracteres.
- `POLITICA_PURGA_APROBADA`: Valor `"NO"` (para garantizar cero borrados físicos de blob).
- `APP_URL`: URL oficial de producción (ej. `https://asistencia-santa-rita.vercel.app`).

### FASE 4: Fusión de Código y Despliegue
1. Realizar commit y push de la rama `feature/terminal-v2-camara-qr`.
2. Crear Pull Request hacia `main` y verificar que el build de CI compile sin errores (`tsc` y `next build`).
3. Ejecutar merge hacia `main`. Vercel compilará y desplegará la versión sin tiempo de inactividad (Zero Downtime Deployment).

### FASE 5: Pruebas Posteriores al Despliegue (Smoke Testing en Vivo)
1. **Terminal Escolar:** Abrir `/marcar` en una laptop del colegio; verificar cámara de pantalla completa y escaneo de un carnet de prueba.
2. **Portal de Padres:** Iniciar sesión con un DNI de prueba; comprobar que cargan las asistencias e historial y que la jornada cerrada no bloquea el acceso.
3. **Invocación de Cron:** Probar con `curl` el endpoint `/api/cron/cierre-jornada` con el Bearer token; verificar respuesta `200 OK` con JSON de detalle.

---

## 5. PROCEDIMIENTO DE REVERSIÓN (ROLLBACK)

Si durante las pruebas post-despliegue se detectara alguna anomalía no prevista:
1. **Reversión de Código en Vercel:**
   - En el dashboard de Vercel -> Deployments, hacer clic en "Redeploy" sobre el commit anterior estable. Esto restaura la versión anterior en menos de 60 segundos.
2. **Reversión en GitHub:**
   - Ejecutar `git revert HEAD` en `main` y empujar al repositorio remoto.
3. **Base de Datos:**
   - Debido a que las migraciones son 100% aditivas (sólo añadieron tablas y columnas no obligatorias), la versión de código previa es completamente compatible y puede seguir operando sin necesidad de hacer rollback en la base de datos de Neon.

---

## 6. PRUEBAS FÍSICAS RECOMENDADAS ANTES DE APERTURA GENERAL

1. Escaneo con carnet físico bajo diferentes condiciones de luz solar y artificial en el patio del colegio.
2. Comprobación del cambio de cámara frontal/trasera en una tablet o celular institucional.
3. Simulación de corte de conexión Wi-Fi temporal en el terminal escolar durante la marcación.
