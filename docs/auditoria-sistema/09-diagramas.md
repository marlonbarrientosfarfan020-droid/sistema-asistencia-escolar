# DOCUMENTO 09: DIAGRAMAS T�CNICOS Y MODELADO DE PROCESOS (BPMN / MERMAID)

**Proyecto:** Sistema de Gesti�n de Asistencia Escolar Multi-Colegio SaaS  
**Est�ndar de Diagramaci�n:** Mermaid v10+ y Notaci�n de Modelado de Procesos BPMN  
**Auditor Responsable:** Arquitecto de Software y Analista Senior de Procesos  

---

## 1. Diagrama 1: Arquitectura General del Sistema

```mermaid
graph TB
    subgraph Clientes ["Capa de Clientes y Dispositivos"]
        C1["Navegador Web Directivo<br/>(Desktop Chrome/Edge)"]
        C2["Kiosco de Garita<br/>(Lector QR / Webcam Facial)"]
        C3["Portal Familiar<br/>(M�vil / Web Padres)"]
    end

    subgraph Edge ["Capa Edge & Enrutamiento (Vercel)"]
        P1["proxy.ts<br/>(Next.js 16 Middleware)"]
        VC["Vercel Cron Job<br/>(0 6 * * 1-5)"]
    end

    subgraph AppServer ["Capa de Aplicaci�n (Next.js 16 / React 19)"]
        subgraph FrontendApp ["Frontend (App Router)"]
            UI1["Dashboard Directivo (/dashboard)"]
            UI2["Pantalla Kiosco Garita (/marcar)"]
            UI3["Portal Apoderados (/portal-padres)"]
            UI4["Monitor SSE en Vivo (/dashboard/monitoreo)"]
        end

        subgraph BackendAPI ["Backend (Route Handlers)"]
            A1["/api/auth/* (Login, Sesiones JWT)"]
            A2["/api/asistencia/registrar"]
            A3["/api/ia/* (Rekognition & Groq LLaMA)"]
            A4["/api/eventos/sse (Server-Sent Events)"]
            A5["/api/cron/alertas-inasistencia"]
            A6["/api/reportes/* & /api/estudiantes/*"]
        end

        subgraph ServiciosCore ["Servicios y L�gica de Negocio"]
            S1["lib/horarios.ts (Clasificador)"]
            S2["lib/asistencia-service.ts (Transacciones)"]
            S3["lib/sse-bus.ts (Event Bus en Memoria)"]
            S4["lib/auth.ts (Jose JWT)"]
        end
    end

    subgraph Persistencia ["Capa de Persistencia"]
        PR["Prisma ORM Client v7.8"]
        DB[("PostgreSQL en Neon Cloud<br/>(Multi-Tenant L�gico)")]
    end

    subgraph Externos ["Servicios en la Nube Externos"]
        AWS["AWS Rekognition<br/>(B�squeda Facial de Estudiantes)"]
        GROQ["Groq Cloud API<br/>(LLaMA-3.3-70b Predictivo)"]
        WSP["Pasarela de Mensajer�a<br/>(WhatsApp / Twilio API)"]
    end

    C1 --> P1
    C2 --> P1
    C3 --> P1
    VC --> A5

    P1 --> FrontendApp
    FrontendApp --> BackendAPI
    BackendAPI --> ServiciosCore
    ServiciosCore --> PR
    PR --> DB

    A3 --> AWS
    A3 --> GROQ
    A2 -.-> WSP
    S3 -.-> UI4
```

---

## 2. Diagrama 2: Mapa de M�dulos del Sistema

```mermaid
graph LR
    subgraph ModulosCore ["M�dulos Operativos Centrales"]
        M01["M01: Autenticaci�n"]
        M03["M03: Kiosco Garita"]
        M04["M04: Facial AI"]
        M05["M05: Monitor SSE"]
        M06["M06: Estudiantes & QR"]
        M08["M08: Salidas Excepcionales"]
        M09["M09: Turnos & Horarios"]
    end

    subgraph ModulosAnalitica ["M�dulos de Gesti�n y Anal�tica"]
        M11["M11: Dashboard KPIs"]
        M12["M12: Reportes Excel/PDF"]
        M13["M13: Inasistencias"]
        M14["M14: IA Deserci�n Escolar"]
        M15["M15: Asistente IA Chat"]
    end

    subgraph ModulosComunidad ["Familias y Comunicaci�n"]
        M02["M02: Portal Padres"]
        M07["M07: Familias & C�digos"]
        M23["M23: Notificaciones"]
        M24["M24: Mensajer�a"]
    end

    subgraph ModulosAdmin ["Administraci�n y Seguridad"]
        M10["M10: Alertas & Cron"]
        M16["M16: Multisede SaaS"]
        M17["M17: Usuarios & Roles"]
        M18["M18: Configuraci�n"]
        M19["M19: Diagn�stico Health"]
        M20["M20: Integraciones"]
        M21["M21: Dev & Reset"]
        M22["M22: Logs Servidor"]
        M25["M25: Calendario Escolar"]
        M26["M26: Auditor�a"]
        M27["M27: Terminales"]
        M28["M28: Backup & Restore"]
    end

    M01 --> ModulosCore
    M01 --> ModulosAnalitica
    M01 --> ModulosAdmin
    M07 --> M02
```

---

## 3. Diagrama 3: Flujo Completo de Funcionamiento

```mermaid
flowchart TD
    Inicio([Inicio de Jornada Escolar]) --> CargarKiosco[Operador abre /marcar en Garita]
    CargarKiosco --> ValidarTerm{�Terminal Autorizada?}
    ValidarTerm -- No --> BloquearTerm[Pantalla de Error HTTP 401]
    ValidarTerm -- S� --> KioscoListo[Kiosco en Espera de Escaneo]

    KioscoListo --> Escaneo[Estudiante escanea Carnet o Rostro]
    Escaneo --> DebounceLocal{�Escaneo < 5 seg?}
    DebounceLocal -- S� --> Ignorar[Ignorar escaneo duplicado]
    DebounceLocal -- No --> EnviarAPI[Enviar a POST /api/asistencia/registrar]

    EnviarAPI --> BuscaAlumno{�Estudiante Activo?}
    BuscaAlumno -- No --> ErrorAlumno[Mostrar Alerta Roja: Retirado o No Existe]
    BuscaAlumno -- S� --> EvaluaDia{�Tiene Asistencia Hoy?}

    EvaluaDia -- No --> RegistraEntrada[Evaluar Puntualidad con Turno]
    RegistraEntrada --> GuardaEntrada[Crear Asistencia en DB: PUNTUAL / TARDE]
    GuardaEntrada --> EmitirSSE[Publicar evento en SSE Bus]
    EmitirSSE --> NotificarWsp[Encolar WhatsApp a Padre]

    EvaluaDia -- S� --> EvaluaSalida{�Tiene Salida Registrada?}
    EvaluaSalida -- S� --> YaSalio[Mostrar Alerta: Alumno ya registr� salida hoy]
    EvaluaSalida -- No --> ValidaPermiso{�Tiene SalidaExcepcional activa?}
    ValidaPermiso -- S� --> SalidaJust[Actualizar DB: SALIDA_JUSTIFICADA]
    ValidaPermiso -- No --> ComparaHora{�Hora actual >= Turno.horaSalida?}
    ComparaHora -- S� --> SalidaReg[Actualizar DB: SALIDA_REGULAR]
    ComparaHora -- No --> SalidaAnt[Actualizar DB: SALIDA_ANTICIPADA]

    SalidaJust --> EmitirSSE
    SalidaReg --> EmitirSSE
    SalidaAnt --> EmitirSSE

    EmitirSSE --> Fin([Fin de Operaci�n])
```

---

## 4. Diagrama 4: Flujo del Registro de Asistencia (Secuencia Detallada)

```mermaid
sequenceDiagram
    autonumber
    actor Alumno as Estudiante / Carnet QR
    participant Kiosco as Pantalla Kiosco (/marcar)
    participant API as API (/api/asistencia/registrar)
    participant Horarios as Servicio (lib/horarios.ts)
    participant DB as PostgreSQL (Prisma)
    participant SSE as Bus SSE (lib/sse-bus.ts)
    participant Monitor as Monitor en Vivo (/dashboard/monitoreo)

    Alumno->>Kiosco: Pasa carnet frente al lector
    Kiosco->>Kiosco: Verifica debounce local (5s)
    Kiosco->>API: POST /api/asistencia/registrar {dni, terminalSecret}
    API->>DB: Valida terminal y busca Estudiante activo
    DB-->>API: Retorna Estudiante + Turno + Asistencia de hoy (si hay)
    
    alt Es primera marcaci�n del d�a (Entrada)
        API->>Horarios: determinarEstadoAsistencia(horaActual, Turno)
        Horarios-->>API: Retorna 'PUNTUAL' o 'TARDE'
        API->>DB: INSERT INTO Asistencia (...)
        DB-->>API: Confirmaci�n de inserci�n (ID)
    else Es segunda marcaci�n del d�a (Salida)
        API->>DB: Comprueba SalidaExcepcional de hoy
        DB-->>API: Retorna estado de autorizaci�n
        API->>Horarios: Eval�a hora de salida de Turno
        Horarios-->>API: Retorna 'SALIDA_REGULAR', 'SALIDA_ANTICIPADA' o 'SALIDA_JUSTIFICADA'
        API->>DB: UPDATE Asistencia SET horaSalida = ahora (...)
        DB-->>API: Confirmaci�n de actualizaci�n
    end

    API->>SSE: emit('NUEVA_MARCACION', datosAlumno)
    SSE-->>Monitor: Transmite evento SSE v�a HTTP Stream
    Monitor->>Monitor: Anima y muestra tarjeta en tiempo real
    API-->>Kiosco: HTTP 200 {status: 'ok', estado, nombre, foto}
    Kiosco->>Kiosco: Emite sonido Beep y muestra tarjeta visual
```

---

## 5. Diagrama 5: Flujo de Autenticaci�n y Autorizaci�n por Roles

```mermaid
flowchart TD
    Login[Usuario ingresa credenciales en /login] --> ValidaHash{�bcrypt.compare exitoso?}
    ValidaHash -- No --> ErrorAuth[HTTP 401: Credenciales inv�lidas]
    ValidaHash -- S� --> CreaJWT[Firmar Token JWT con jose HS256]
    CreaJWT --> SetCookie[Set-Cookie: sesion_santa_rita HttpOnly, SameSite=Lax]
    SetCookie --> Redirect[Redirige a /dashboard]

    Redirect --> ProxyEdge{proxy.ts: �Cookie existe?}
    ProxyEdge -- No --> GoLogin[Redirige a /login]
    ProxyEdge -- S� --> PageLayout[app/dashboard/layout.tsx]

    PageLayout --> ObtenerSesion[lib/auth.ts: Verifica firma y extrae Rol]
    ObtenerSesion --> FiltraMenu{Eval�a Rol del Usuario}
    
    FiltraMenu -- SUPERADMIN --> MenuCompleto[Acceso Total: Colegios, Config, Logs, Dev]
    FiltraMenu -- ADMIN_COLEGIO / DIRECTOR --> MenuDirectivo[Estudiantes, Asistencias, Reportes, IA, Turnos]
    FiltraMenu -- COORDINADOR --> MenuCoord[Estudiantes, Monitoreo, Reportes, Salidas]
    FiltraMenu -- RECEPCION --> MenuRecep[Kiosco Marcaci�n y Salidas Excepcionales]
```

---

## 6. Diagrama 6: Flujo de Comunicaci�n con la Base de Datos

```mermaid
graph TD
    subgraph NextServer ["Servidor Next.js (Node.js Runtime)"]
        RouteHandler["Route Handlers (/api/*)"]
        PrismaClient["Prisma Client Singleton (lib/prisma.ts)"]
        Engine["Prisma Query Engine"]
    end

    subgraph NeonDB ["Neon Serverless PostgreSQL"]
        PgPool["PgBouncer Connection Pooler (Puerto 6543)"]
        PostgresCore[("PostgreSQL Database Core (Tables & Indexes)")]
    end

    RouteHandler -->|"Invocaci�n tipada (ej. prisma.asistencia.findFirst)"| PrismaClient
    PrismaClient --> Engine
    Engine -->|"SQL Parametrizado (SSL TCP)"| PgPool
    PgPool -->|"Transacciones concurrentes seguras"| PostgresCore
    PostgresCore -->|"Resultados tabulares / JSON"| PgPool
    PgPool --> Engine
    Engine --> PrismaClient
    PrismaClient -->|"Objetos TypeScript tipados"| RouteHandler
```

---

## 7. Diagrama 7: Flujo del Cron Job y Detecci�n de Faltas

```mermaid
flowchart TD
    VercelCron[Vercel Cron: Dispara a las 06:00 UTC] --> GetEndpoint[GET /api/cron/alertas-inasistencia]
    GetEndpoint --> CheckBearer{�Authorization Bearer v�lido?}
    CheckBearer -- No --> Http401[HTTP 401 Unauthorized]
    CheckBearer -- S� --> ConsultaFeriado{�Hoy es Feriado en CalendarioEscolar?}
    ConsultaFeriado -- S� --> FinFeriado[Suspender ejecuci�n: D�a no lectivo]
    ConsultaFeriado -- No --> ConsultaColegios[Iterar sobre Colegios y Turnos activos]

    ConsultaColegios --> ValidaTolerancia{�Hora actual > horaInicioTardanza?}
    ValidaTolerancia -- No --> EsperarTurno[Turno a�n en ventana de entrada: Omitir]
    ValidaTolerancia -- S� --> BuscarAusentes[Buscar Estudiantes activos sin asistencia hoy]

    BuscarAusentes --> HayAusentes{�Se encontraron alumnos ausentes?}
    HayAusentes -- No --> LogCero[Registrar 0 inasistencias en Auditor�a]
    HayAusentes -- S� --> BucleAusentes[Para cada estudiante ausente]

    BucleAusentes --> CreaFalta[INSERT Asistencia: estado = 'FALTA', tipo = 'SISTEMA_CRON']
    CreaFalta --> EncolaNotif[INSERT Notificacion: canal = 'WHATSAPP', estado = 'PENDIENTE']
    EncolaNotif --> RegistraAudit[INSERT Auditoria: Resumen de lote generado]
    RegistraAudit --> FinCron([Fin del Proceso Autom�tico])
```

---

## 8. Diagrama 8: Flujo de Procesos Institucional Estilo BPMN / Bizagi

A continuaci�n se modela el proceso de negocio completo con carriles de responsabilidad (Swimlanes):

```mermaid
sequenceDiagram
    autonumber
    box rgba(33, 150, 243, 0.1) Estudiante y Apoderado
    actor Estudiante
    actor Apoderado
    end

    box rgba(76, 175, 80, 0.1) Personal del Colegio
    actor OperadorGarita as Operador de Garita
    actor Coordinador as Coordinaci�n / Direcci�n
    end

    box rgba(156, 39, 176, 0.1) Sistema Automatizado
    participant Sistema as Sistema de Asistencia
    participant BaseDatos as Base de Datos (PostgreSQL)
    end

    Note over Estudiante, Sistema: SUBPROCESO 1: LLEGADA Y REGISTRO EN PUERTA
    Estudiante->>OperadorGarita: Presenta Carnet Escolar en Garita
    OperadorGarita->>Sistema: Escanea c�digo con lector �ptico
    Sistema->>BaseDatos: Verifica horario, tolerancia y asistencia previa
    BaseDatos-->>Sistema: Retorna evaluaci�n horaria

    alt Alumno llega puntual
        Sistema-->>OperadorGarita: Luz Verde + Sonido de Aprobaci�n (Puntual)
        Sistema->>BaseDatos: Registra entrada PUNTUAL
    else Alumno llega con retraso
        Sistema-->>OperadorGarita: Luz Amarilla (Tardanza Registrada)
        Sistema->>BaseDatos: Registra entrada TARDE
    end

    Sistema-->>Coordinador: Transmite marcaci�n en vivo por Monitor SSE

    Note over Estudiante, Sistema: SUBPROCESO 2: RETIRO EXCEPCIONAL POR SALUD / URGENCIA
    Apoderado->>Coordinador: Solicita retiro anticipado del menor
    Coordinador->>Sistema: Registra Salida Excepcional (Motivo y DNI Apoderado)
    Sistema->>BaseDatos: Almacena SalidaExcepcional en estado AUTORIZADO
    Estudiante->>OperadorGarita: Se presenta en puerta para salir
    OperadorGarita->>Sistema: Escanea carnet del alumno para egreso
    Sistema->>BaseDatos: Verifica existencia de SalidaExcepcional autorizada
    BaseDatos-->>Sistema: Autorizaci�n confirmada
    Sistema-->>OperadorGarita: Pantalla Verde: Salida Autorizada
    Sistema->>BaseDatos: Actualiza Asistencia a SALIDA_JUSTIFICADA

    Note over Apoderado, Sistema: SUBPROCESO 3: CIERRE DE JORNADA Y CONSULTA FAMILIAR
    Sistema->>BaseDatos: Cron detecta alumnos que nunca ingresaron y marca FALTA
    Apoderado->>Sistema: Ingresa a Portal de Padres con DNI y C�digo Secreto
    Sistema->>BaseDatos: Consulta historial del estudiante
    BaseDatos-->>Sistema: Retorna asistencias del mes
    Sistema-->>Apoderado: Muestra tarjeta con horas y estados de puntualidad
```
