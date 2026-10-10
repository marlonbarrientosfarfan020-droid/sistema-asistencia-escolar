# DOCUMENTO 07: AUDITOR�A DE SEGURIDAD Y AN�LISIS DE VULNERABILIDADES

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Est�ndar de Evaluaci�n:** OWASP Top 10 (2021/2025) y Buenas Pr�cticas en Protecci�n de Datos de Menores  
**Auditor Responsable:** Especialista en Ciberseguridad y Auditor�a de Software  

---

## 1. Resumen Ejecutivo de la Postura de Seguridad

El sistema implementa mecanismos s�lidos de seguridad moderna en la capa base: utiliza contrase�as con hash bcrypt (salt 10), tokens de sesi�n JWT firmados criptogr�ficamente mediante la librer�a `jose`, cookies con directivas de seguridad (`HttpOnly`, `SameSite=Lax`, `Secure`), consultas parametrizadas a trav�s de Prisma ORM que mitigan inyecciones SQL nativas, y una bit�cora de auditor�a inmutable.

Sin embargo, la auditor�a est�tica del c�digo fuente revel� **hallazgos cr�ticos de aislamiento multi-inquilino y l�gica destructiva** que deben subsanarse inmediatamente para garantizar la integridad institucional.

---

## 2. Matriz de Hallazgos y Vulnerabilidades Clasificadas

| ID | Hallazgo de Seguridad | Ubicaci�n en C�digo Fuente | Criticidad | Vector de Riesgo |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Vaciado de Base de Datos sin Filtro de Tenant (Bypass Multi-Colegio)** | `app/api/desarrollador/reiniciar-sistema/route.ts` | **CR�TICA** | Broken Access Control / Destrucci�n Masiva de Datos |
| **SEC-02** | **Backup Incompleto con P�rdida de Datos en Restauraci�n** | `app/api/backup/route.ts` y `restaurar/route.ts` | **ALTA** | Integridad y Disponibilidad de Datos |
| **SEC-03** | **Verificaci�n Parcial de Sesi�n en el Edge (`proxy.ts`)** | `proxy.ts` L12-L28 | **MEDIA** | Session Management / Inconsistencia |
| **SEC-04** | **Exposici�n de Rol en `localStorage` del Cliente** | `app/dashboard/layout.tsx` L45 | **MEDIA** | Client-Side Role Manipulation |
| **SEC-05** | **Almacenamiento y Protecci�n de Datos Biom�tricos de Menores** | `app/api/ia/reconocimiento-facial/route.ts` | **ALTA** | Cumplimiento Normativo de Privacidad (Protecci�n de Menores) |
| **SEC-06** | **Riesgo por Inyecci�n SQL en Consultas Raw (`$queryRaw`)** | `lib/health.ts` y reportes complejos | **BAJA** | SQL Injection (Actualmente parametrizado con tagged templates) |
| **SEC-07** | **Seguridad del Endpoint de Tareas Autom�ticas (Cron)** | `app/api/cron/alertas-inasistencia/route.ts` | **BAJA (Controlado)** | Unauthorized Access (Protegido con Bearer Token) |

---

## 3. An�lisis Detallado de Vulnerabilidades Cr�ticas y Altas

### 3.1 SEC-01: Vaciado de Datos sin Tenant en Endpoint de Desarrollador (CR�TICA)
- **Archivo:** `app/api/desarrollador/reiniciar-sistema/route.ts`
- **Evidencia T�cnica:**
  ```typescript
  // C�digo vulnerable detectado en el backend:
  await prisma.asistencia.deleteMany();
  await prisma.estudiante.deleteMany();
  await prisma.auditoria.deleteMany();
  ```
- **Impacto:**  
  La consulta ejecuta un `deleteMany()` global sin especificar la cl�usula `where: { colegioId }`. En un entorno SaaS donde conviven m�ltiples instituciones, si el administrador de un colegio ejecuta esta funci�n (o si un atacante compromete una cuenta `ADMIN_COLEGIO`), **se borrar�n todos los estudiantes, marcaciones y auditor�as de TODOS los colegios registrados en la plataforma**.
- **Agravante:** Destruye la tabla `Auditoria`, eliminando la evidencia forense del incidente.
- **Soluci�n Obligatoria:**
  1. Restringir la ruta exclusivamente al rol `SUPERADMIN` en ambiente local/staging (`process.env.NODE_ENV !== 'production'`).
  2. Deshabilitar por completo este endpoint en el despliegue de producci�n.
  3. En caso de pruebas, limitar estrictamente:
     ```typescript
     await prisma.asistencia.deleteMany({ where: { colegioId: sesion.colegioId } });
     await prisma.estudiante.deleteMany({ where: { colegioId: sesion.colegioId } });
     ```
  4. Jam�s permitir la eliminaci�n de la tabla `Auditoria`.

### 3.2 SEC-02: Backup Incompleto y Restauraci�n Destructiva (ALTA)
- **Archivo:** `app/api/backup/route.ts` y `app/api/backup/restaurar/route.ts`
- **Evidencia T�cnica:**  
  El volcado JSON de copia de seguridad solo extrae `Colegio`, `Usuario`, `Turno`, `Estudiante`, `Asistencia` y `CalendarioEscolar`. Omite completamente las tablas:
  - `Terminal` (tokens de hardware de quioscos).
  - `SalidaExcepcional` (justificaciones legales de retiros de menores).
  - `EvidenciaFotografica` (evidencia visual de marcaciones en garita).
- **Impacto:**  
  Al restaurar un backup, el c�digo borra los registros existentes antes de importar el JSON. Dado que el JSON no incluye estas 3 tablas, los permisos de salida y tokens de quiosco se pierden para siempre, y pueden generarse errores de restricci�n de clave for�nea en cascada.
- **Soluci�n Obligatoria:**  
  Incluir todas las 20 tablas relacionales en el dump JSON o utilizar las herramientas nativas de backup a nivel de motor (`pg_dump` administrado por Neon PostgreSQL).

### 3.3 SEC-03 y SEC-04: Gesti�n de Sesi�n y Rol en Cliente (MEDIA)
- **Archivos:** `proxy.ts` y `app/dashboard/layout.tsx`
- **Evidencia T�cnica:**
  - `proxy.ts` comprueba si existe la cookie `sesion_santa_rita`, pero no verifica criptogr�ficamente su firma JWT ni su vigencia temporal antes de redirigir. La verificaci�n completa se delega a las p�ginas y rutas API individuales.
  - El sidebar del dashboard lee el rol desde `localStorage.getItem('rol')` para mostrar u ocultar opciones visuales.
- **Impacto:**  
  Cualquier usuario puede modificar su `localStorage` en la consola del navegador y hacer visibles las opciones del men� de Superadmin o Director. Si bien el backend rechaza las peticiones API no autorizadas (evitando la elevaci�n de privilegios real), genera confusi�n visual y expone la topolog�a interna del sistema a usuarios no calificados.
- **Soluci�n Obligatoria:**  
  Eliminar el rol de `localStorage`. Renderizar el men� del Dashboard enteramente en componentes de servidor (`Server Components`) a partir de la sesi�n verificada en el JWT.

### 3.4 SEC-05: Protecci�n de Datos Biom�tricos y Fotos de Menores (ALTA)
- **Archivos:** `app/api/ia/reconocimiento-facial/route.ts` y `lib/aws-rekognition.ts`
- **Marco Legal:** Ley de Protecci�n de Datos Personales (Ley N� 29733 en Per� / RGPD a nivel internacional).
- **Evidencia T�cnica:**  
  Las fotos de perfil de los estudiantes y las capturas en garita se env�an a AWS Rekognition para generar vectores faciales.
- **Impacto:**  
  Los datos biom�tricos de menores de edad son considerados datos altamente sensibles. Se requiere:
  - Consentimiento informado expl�cito firmado por el apoderado en la ficha de matr�cula.
  - Cifrado en reposo en el almacenamiento de fotos.
  - Colecciones de AWS Rekognition aisladas por cada colegio (`colegio_${id}`) para evitar que un estudiante de un colegio coincida en la b�squeda de otro.
- **Estado Actual:** El sistema utiliza colecciones de Rekognition parametrizadas por colegio, lo cual es una excelente pr�ctica arquitect�nica, pero requiere documentar los t�rminos de consentimiento en el portal de padres.

---

## 4. Auditor�a de Protecciones Cl�sicas

### 4.1 Inyecci�n SQL (SQLi)
- **Estado:** **PROTEGIDO (Riesgo Bajo)**.
- **An�lisis:** El proyecto utiliza Prisma ORM como capa de abstracci�n de datos. Todas las operaciones est�ndar (`findMany`, `create`, `update`) emplean consultas preparadas con par�metros separados.
- **Revisi�n de Raw Queries:** Las pocas consultas nativas como `SELECT 1` en `lib/health.ts` utilizan tagged templates `prisma.$queryRaw``, que son autom�ticamente parametrizadas por Prisma, evitando concatenaciones inseguras de cadenas.

### 4.2 Cross-Site Scripting (XSS)
- **Estado:** **PROTEGIDO (Riesgo Bajo)**.
- **An�lisis:** El frontend est� construido con React 19 / Next.js 16. La sintaxis JSX escapa autom�ticamente cualquier contenido din�mico insertado en el DOM, neutralizando inyecciones de c�digo HTML/JavaScript. No se encontraron usos peligrosos de `dangerouslySetInnerHTML`.

### 4.3 Cross-Site Request Forgery (CSRF)
- **Estado:** **PROTEGIDO (Riesgo Bajo)**.
- **An�lisis:** La cookie de sesi�n `sesion_santa_rita` est� configurada con el flag `SameSite: 'lax'`. Esto impide que navegadores env�en la cookie en solicitudes cruzadas iniciadas por sitios web maliciosos de terceros.

### 4.4 Exposici�n de Variables de Entorno y Secretos
- **Estado:** **CONTROLADO**.
- **An�lisis:** Todas las credenciales sensibles (`DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) est�n contenidas en el archivo `.env` del servidor y ninguna tiene el prefijo p�blico `NEXT_PUBLIC_`, lo que garantiza que nunca se filtren al c�digo JavaScript del cliente.
