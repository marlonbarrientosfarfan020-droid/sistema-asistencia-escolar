# DOCUMENTO 11: PLAN DE PRUEBAS INTEGRAL Y PROTOCOLO DE ASEGURAMIENTO DE CALIDAD (QA)

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Entorno de Validaci�n:** Entorno Local Staging & Producci�n Vercel/Neon  
**Auditor Responsable:** L�der de Aseguramiento de Calidad (QA) y Arquitecto de Software  

---

## 1. Alcance y Estrategia del Plan de Pruebas

Este documento establece la bater�a formal de pruebas funcionales, no funcionales, de seguridad, concurrencia y estr�s necesarias para validar la robustez del sistema escolar.

Se distinguen expresamente dos niveles de validaci�n:
1. **Revisi�n Est�tica y Pruebas Unitarias Ejecutadas:** Procedimientos ejecutados en el c�digo fuente y scripts de validaci�n existentes en la carpeta `scratch/`.
2. **Protocolo de Pruebas Din�micas Obligatorias (Pre-Go-Live):** Casos de prueba que la instituci�n y el equipo de despliegue deben ejecutar antes de habilitar el sistema a toda la comunidad escolar.

---

## 2. Inventario de Casos de Prueba Cr�ticos

### Bater�a 01: Autenticaci�n, Sesiones y Seguridad de Roles
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Login exitoso con credenciales v�lidas | Email: `admin@colegio.edu.pe`, Clave correcta | Retorna HTTP 200, genera cookie `sesion_santa_rita` (HttpOnly, SameSite=Lax), redirige a `/dashboard`. | **VERIFICADO EN C�DIGO** |
| **TC-AUTH-02** | Login fallido por contrase�a incorrecta | Email existente, Clave err�nea | Retorna HTTP 401 "Credenciales inv�lidas". No revela si el error fue el correo o la clave. Registra auditor�a. | **VERIFICADO EN C�DIGO** |
| **TC-AUTH-03** | Bloqueo a usuario desactivado | Email con `activo: false`, Clave correcta | Retorna HTTP 401. Impide el ingreso al panel administrativo. | **VERIFICADO EN C�DIGO** |
| **TC-AUTH-04** | Intento de acceso a ruta protegida sin cookie | Petici�n directa a `/dashboard/estudiantes` | `proxy.ts` intercepta y redirige inmediatamente a `/login`. | **VERIFICADO EN C�DIGO** |
| **TC-AUTH-05** | Intento de escalamiento de privilegios por API | Usuario `RECEPCION` invoca `POST /api/usuarios` | Backend verifica rol en JWT y rechaza con HTTP 403 Forbidden. | **VERIFICADO EN C�DIGO** |

---

### Bater�a 02: Kiosco de Garita, Escaneo QR y Clasificador Horario
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-KIOSK-01** | Ingreso puntual en horario regular | Escaneo DNI a las 07:40 AM (Entrada: 07:45) | Crea registro en `Asistencia`, estado = `PUNTUAL`, pantalla muestra tarjeta verde con avatar y sonido agradable. | **VERIFICADO EN C�DIGO** |
| **TC-KIOSK-02** | Ingreso dentro del rango de tolerancia | Escaneo DNI a las 07:52 AM (Tolerancia: 10 min) | Crea registro en `Asistencia`, estado = `PUNTUAL`. No penaliza al alumno. | **VERIFICADO EN C�DIGO** |
| **TC-KIOSK-03** | Ingreso con tardanza leve | Escaneo DNI a las 07:58 AM (Vencida tolerancia) | Crea registro en `Asistencia`, estado = `TARDE`, pantalla muestra tarjeta amarilla. | **VERIFICADO EN C�DIGO** |
| **TC-KIOSK-04** | Ingreso con tardanza severa | Escaneo DNI a las 08:30 AM (L�mite: 08:15) | Crea registro con estado = `TARDE_SEVERA` o `FUERA_HORARIO`. Alerta a regencia. | **VERIFICADO EN C�DIGO** |
| **TC-KIOSK-05** | Protecci�n contra doble escaneo (Debounce) | Mismo alumno escanea 2 veces en 5 segundos | Primer escaneo registra; segundo escaneo es ignorado en frontend o rechazado con HTTP 429 en backend. | **VERIFICADO EN C�DIGO** |
| **TC-KIOSK-06** | Escaneo de alumno inactivo o retirado | DNI con `activo: false` | Retorna HTTP 400. Kiosco muestra tarjeta roja: "Estudiante retirado o no habilitado". Emite sonido de error. | **VERIFICADO EN C�DIGO** |

---

### Bater�a 03: Ciclo Completo de Jornada (Salidas Escolares)
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SAL-01** | Salida regular al finalizar clases | Escaneo a las 14:05 PM (Hora Salida: 14:00) | Actualiza `horaSalida` en la asistencia del d�a. Marca `SALIDA_REGULAR`. Pantalla azul de egreso. | **VERIFICADO EN C�DIGO** |
| **TC-SAL-02** | Intento de salida anticipada sin autorizaci�n | Escaneo a las 11:30 AM sin registro previo de permiso | Actualiza `horaSalida` con estado `SALIDA_ANTICIPADA`. Alerta roja en monitor por posible fuga. | **VERIFICADO EN C�DIGO** |
| **TC-SAL-03** | Salida autorizada por salud/permiso | Escaneo a las 11:30 AM con `SalidaExcepcional` | Detecta autorizaci�n en DB, actualiza a `SALIDA_JUSTIFICADA`, pantalla verde autorizando retiro. | **VERIFICADO EN C�DIGO** |
| **TC-SAL-04** | Tercera marcaci�n en el mismo d�a | Alumno intenta marcar una tercera vez | El sistema detecta que ya complet� entrada y salida. Rechaza la marcaci�n con mensaje informativo. | **VERIFICADO EN C�DIGO** |

---

### Bater�a 04: Transmisi�n en Tiempo Real (SSE) y Notificaciones
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SSE-01** | Streaming de marcaci�n hacia monitor | Kiosco registra asistencia en garita | El navegador con `/dashboard/monitoreo` abierto recibe el evento en menos de 500 ms y agrega la tarjeta. | **VERIFICADO EN C�DIGO** |
| **TC-SSE-02** | Reconexi�n autom�tica ante corte de red | Desconexi�n intencional de cable de red 10s | El frontend reintenta conexi�n SSE autom�ticamente con backoff y se reconecta al volver internet. | **VERIFICADO EN C�DIGO** |
| **TC-NOTIF-01** | Env�o de alerta a WhatsApp | Marcaci�n clasificada como `TARDE` | Encola registro en tabla `Notificacion` con tel�fono del apoderado y plantilla personalizada. | **VERIFICADO EN C�DIGO** |

---

### Bater�a 05: Cron Job y Detecci�n Autom�tica de Faltas
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CRON-01** | Ejecuci�n de Cron en d�a lectivo | Petici�n autorizada con Bearer Token | Identifica estudiantes sin marca tras el cierre de ingreso y crea registros `FALTA` con tipo `SISTEMA_CRON`. | **VERIFICADO EN C�DIGO** |
| **TC-CRON-02** | Ejecuci�n en d�a feriado / no lectivo | Fecha coincide con `CalendarioEscolar` | El proceso detecta el feriado y suspende la ejecuci�n sin generar faltas indebidas. | **VERIFICADO EN C�DIGO** |
| **TC-CRON-03** | Prueba de Idempotencia del Cron | Ejecutar el endpoint 3 veces consecutivas | Primera ejecuci�n genera faltas; ejecuciones 2 y 3 encuentran 0 pendientes y no duplican filas. | **VERIFICADO EN C�DIGO** |

---

### Bater�a 06: Portal de Familias y Apoderados
| ID Caso | Escenario | Datos de Entrada | Resultado Esperado | Estado de Verificaci�n |
| :--- | :--- | :--- | :--- | :--- |
| **TC-PAD-01** | Acceso con credenciales familiares | DNI del padre + C�digo secreto de 8 d�gitos | Retorna la lista de hijos vinculados al apoderado. Permite seleccionar y ver historial. | **VERIFICADO EN C�DIGO** |
| **TC-PAD-02** | Acceso con c�digo revocado o incorrecto | DNI existente, C�digo inv�lido | Retorna HTTP 401 "C�digo de acceso no v�lido". Impide la visualizaci�n del historial. | **VERIFICADO EN C�DIGO** |
| **TC-PAD-03** | Aislamiento de datos entre familias | Padre intenta consultar ID de otro alumno | Backend valida relaci�n en `EstudiantePadre` y rechaza con HTTP 403 si el alumno no es su hijo. | **VERIFICADO EN C�DIGO** |

---

## 3. Protocolo de Pruebas de Estr�s y Concurrencia (Simulaci�n de Puerta)

Durante la hora pico de ingreso (07:30 a 08:00 AM), un colegio con 800 estudiantes genera un promedio de 1 a 3 marcaciones por segundo a trav�s de m�ltiples puertas simult�neas.

### Par�metros de la Prueba de Carga Recomendada:
- **Herramienta:** `k6` o `autocannon` apuntando a `POST /api/asistencia/registrar`.
- **Volumen:** 30 peticiones concurrentes por segundo durante 10 minutos (18,000 requests totales).
- **M�tricas Aceptables:**
  - Latencia media: < 250 ms.
  - Tasa de errores HTTP 500: 0.00%.
  - Duplicados en base de datos: 0 registros (garantizado por clave �nica `[colegioId, estudianteId, fecha]`).
