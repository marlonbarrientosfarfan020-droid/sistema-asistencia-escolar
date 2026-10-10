# INFORME DE AUDITORÍA INTEGRAL DE SOFTWARE
## DOCUMENTO 02: ARQUITECTURA GENERAL DEL SISTEMA

---

| Metadato | Detalle Técnico |
| :--- | :--- |
| **Documento** | 02 - Arquitectura General, Tecnologías y Configuración de Despliegue |
| **Sistema Auditado** | Sistema de Control de Asistencia Escolar Inteligente Multi-Colegio SaaS |
| **Versión Inspeccionada** | 1.0 (Release Candidate / Producción) |
| **Fecha de Auditoría** | Octubre de 2026 |
| **Entorno de Ejecución** | Node.js v20+ / Next.js 16.2.9 Serverless Runtime |

---

### 1. NOMBRE Y PROPÓSITO DEL SISTEMA

El **Sistema de Control de Asistencia Escolar Inteligente** es una plataforma tecnológica integral basada en la nube, diseñada para la gestión, fiscalización, automatización y blindaje de la asistencia escolar, puntualidad, retiros excepcionales y detección temprana de deserción en instituciones educativas.

El sistema opera bajo un modelo **SaaS Multi-Colegio (Multi-Tenant)** con aislamiento lógico y contextual por institución (colegioId: ej. SANTA_RITA_001 para el Colegio de referencia I.E.P. Santa Rita de Casia). Sus propósitos primordiales son:
1. Eliminar los cuellos de botella en la garita escolar mediante marcación ultra-rápida (DNI, código QR o reconocimiento biométrico facial).
2. Automatizar el cálculo de puntualidad y tardanzas con sincronización horaria estricta de Perú (America/Lima UTC-05:00).
3. Notificar en tiempo real a padres y apoderados mediante mensajería instantánea omnicanal (WhatsApp y Telegram).
4. Proveer un portal web seguro para padres de familia agrupados por código familiar.
5. Anticipar el riesgo de deserción y abandono escolar mediante analítica predictiva de inteligencia artificial (Groq LLaMA 3.1).

---

### 2. STACK TECNOLÓGICO Y LENGUAJES DE PROGRAMACIÓN

La plataforma está construida utilizando un stack de vanguardia tipado estrictamente de extremo a extremo:

| Capa Tecnológica | Tecnología / Herramienta | Versión | Rol en el Sistema |
| :--- | :--- | :---: | :--- |
| **Lenguaje Base** | TypeScript | 5.x | Tipado estático en el 100% de la base de código; garantiza cero variables implícitas ny. |
| **Runtime Servidor** | Node.js | v20+ / v24 | Entorno de ejecución serverless para Route Handlers y lógica de backend. |
| **Framework Base** | Next.js (App Router) | 16.2.9 | Enrutamiento híbrido (Server Components, Client Components, Route Handlers), Turbopack y compilación Edge/Serverless. |
| **Librería de Vista** | React | 19.2.4 | Renderizado reactivo y concurrente de interfaces de usuario. |
| **Motor de Estilos** | Tailwind CSS | v4.0 | Sistema de diseño de alto impacto visual con soporte de temas responsivos y Glassmorphism. |
| **Persistencia / ORM** | Prisma Client & CLI | 7.8.0 | ORM declarativo, generación de clientes fuertemente tipados e integridad referencial estricta. |
| **Base de Datos** | PostgreSQL (Neon Cloud) | v16 | Base de datos relacional serverless con pooler de conexiones activas bajo SSL (@prisma/adapter-pg). |
| **Almacenamiento Cloud** | Vercel Blob Storage | 2.6.1 | Almacenamiento CDN en la nube para fotos de evidencia tomadas en portería y logotipos institucionales. |
| **Biometría Facial** | AWS SDK Client Rekognition | 3.1102.0 | Indexación de rostros y búsqueda de similitud biométrica facial (>97% de confianza). |
| **Inteligencia Artificial** | Groq SDK (LLaMA 3.1 8B Instant) | 1.3.0 | Inferencia ultrarrápida (<500ms) para diagnóstico preventivo de deserción escolar. |
| **IA Secundaria** | Google GenAI SDK | 2.10.0 | Servicio alternativo configurado en services/geminiService.ts. |
| **Autenticación Criptográfica** | Jose & BCrypt.js | 6.2.3 / 3.0.3 | Tokens JWT firmados con HS256 en cookies HttpOnly, y hashing seguro de contraseñas de usuarios. |
| **Eventos en Tiempo Real** | Server-Sent Events (SSE) | Nativo Node | Streaming continuo unidireccional de marcaciones en garita hacia los dashboards. |
| **Generación de Reportes** | jsPDF + AutoTable / SheetJS (XLSX) | 4.2.1 / 0.18.5 | Generación de reportes PDF con membrete institucional y exportación de sábanas en Excel. |
| **Lectura de Credenciales** | HTML5-QRCode / QRCode | 2.3.8 / 1.5.4 | Generador e intérprete óptico de credenciales y carnets escolares en webcams y móviles. |
| **Gráficos 3D** | Three.js | 0.185.1 | Escudo institucional 3D animado con iluminación WebGL e inercia rotacional en el portal de login. |
| **Analítica Visual** | Recharts | 3.9.0 | Visualización gráfica de curvas de asistencia, tortas de puntualidad y tendencias semanales. |
| **Automatización y Cron** | Vercel Cron & Node-Cron | 4.5.0 | Tareas programadas periódicas en la nube y soporte offline para ejecución local. |

---

### 3. ARQUITECTURA DEL FRONTEND Y BACKEND

El sistema adopta una arquitectura desacoplada y orientada a servicios dentro del monorrepito de Next.js App Router:

`
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DEL SISTEMA                        │
├────────────────────────────────────────────────────────────────────────┤
│  CAPA CLIENTE / UI (React 19 + Tailwind v4 + Three.js)                 │
│  ├── Pantalla de Quiosco / Portería (app/marcar/page.tsx)              │
│  ├── Panel Central de Dirección (app/dashboard/page.tsx)               │
│  ├── Monitoreo y Salud en Vivo (app/dashboard/monitoreo/page.tsx)      │
│  ├── Portal Web para Familias (app/portal-padres/page.tsx)             │
│  └── Gestión de Salidas Excepcionales (app/dashboard/salidas/page.tsx) │
├────────────────────────────────────────────────────────────────────────┤
│  CAPA DE CONTROL / PERÍMETRO Y GUARDAS                                 │
│  ├── Proxy Perimetral Next.js 16 (proxy.ts)                            │
│  ├── Guardas del SuperMotor (lib/supermotor-guard.ts)                  │
│  ├── Capa de Contexto Multi-Tenant (lib/tenant.ts)                     │
│  └── Autenticación Criptográfica de Terminales (lib/terminal-auth.ts) │
├────────────────────────────────────────────────────────────────────────┤
│  CAPA DE DOMINIO / BACKEND SERVERLESS                                  │
│  ├── SuperMotor Central Escolar (lib/supermotor.ts)                    │
│  ├── Clasificador Horario Unificado (lib/clasificadorAsistencia.ts)    │
│  ├── Motor de Ciclo de Jornada (services/jornada/motorJornada.ts)      │
│  ├── Motor de Automatizaciones (services/automatizaciones/)            │
│  └── Bus de Eventos Escolar SSE (lib/events/eventBus.ts)               │
├────────────────────────────────────────────────────────────────────────┤
│  INTEGRACIONES Y SERVICIOS EXTERNOS                                    │
│  ├── AWS Rekognition (Colección Facial: santa-rita-estudiantes)        │
│  ├── Groq LLaMA 3.1 8B Instant (IA de Riesgo Escolar)                  │
│  ├── Meta WhatsApp Cloud API (Graph API v20.0)                         │
│  ├── Telegram Bot API (Canal Directivo y Apoderados)                   │
│  └── Vercel Blob Storage (CDN Evidencias Fotográficas)                 │
├────────────────────────────────────────────────────────────────────────┤
│  PERSISTENCIA Y MODELO DE DATOS                                        │
│  ├── PostgreSQL en Neon Cloud (Connection Pooling SSL)                 │
│  └── Prisma ORM (20 Modelos Relacionales y Transacciones Atómicas)     │
└────────────────────────────────────────────────────────────────────────┘
`

#### Arquitectura Frontend:
- **Server Components (RSC):** Utilizados para el layout general, envoltorios de páginas estáticas e inyección inicial de metadatos SEO.
- **Client Components (use client):** Utilizados intensivamente en todas las páginas interactivas (pp/marcar, pp/dashboard, pp/dashboard/monitoreo, pp/portal-padres), debido a que requieren acceso al DOM de la cámara, listeners de teclado, WebGL de Three.js y conexiones reactivas SSE (useRealtimeEvents.ts).
- **Control de Estados y Caché:** Actualizaciones optimistas en el dashboard ante eventos entrantes del bus SSE, con mecanismo de debounce de 1500 ms para revalidar contra la API sin saturar el pool de base de datos.

#### Arquitectura Backend:
- **Route Handlers (pp/api/*/route.ts):** 33 módulos de API que implementan verbos HTTP REST (GET, POST, PUT, DELETE).
- **SuperMotor Central (lib/supermotor.ts):** Gobernador central del ciclo de vida escolar. Almacena en la tabla SistemaControl el estado de la jornada (CERRADO, APERTURA, OPERATIVO, CIERRE) y los interruptores independientes para 8 módulos (sistencia, otos, portal, 	elegram, whatsapp, eportes, ia, lertas). Implementa una caché en memoria de 5 segundos (CACHE_TTL_MS = 5000) para no sobrecargar PostgreSQL.
- **SuperMotor Guard (lib/supermotor-guard.ts):** Función de barrera interceptora que devuelve HTTP 423 (*Locked*) o HTTP 403 cuando el motor o un módulo se encuentran apagados, registrando automáticamente la auditoría de bloqueo.
- **EventBus en Memoria (lib/events/eventBus.ts):** Instancia de EventEmitter anclada en globalThis con capacidad para 500 listeners concurrentes, encargada de distribuir eventos a las conexiones activas de Server-Sent Events.

---

### 4. SISTEMA DE AUTENTICACIÓN Y AUTORIZACIÓN

El sistema posee cuatro mecanismos diferenciados de autenticación:

1. **Autenticación Administrativa y de Personal (lib/auth.ts):**
   - **Protocolo:** Token JWT firmado mediante el algoritmo HS256 utilizando la librería jose.
   - **Clave Secreta:** Variable AUTH_SECRET (obligatoria, mínimo 32 caracteres criptográficos).
   - **Almacenamiento:** Cookie de navegación HttpOnly, con flag Secure en producción, SameSite=Lax y expiración de 8 horas (sesion_santa_rita).
   - **Roles Soportados:** SUPER_ADMIN, ADMIN, ADMIN_COLEGIO, DIRECTIVO, DIRECTOR, DEMO, PERSONAL, PADRE.
   - **Jerarquías de Acceso:** Funciones guardas estrictas como exigirAdmin(), exigirDirector(), exigirAdminOPersonal(), exigirSuperAdmin().

2. **Autenticación del Portal de Familias (lib/auth-padres.ts):**
   - **Protocolo:** Token JWT firmado HS256 con payload (codigoFamiliarId, codigoFamiliar, 	utorTitular).
   - **Almacenamiento:** Cookie HttpOnly independiente denominada sesion_padre_santa_rita, con vigencia de 7 días.
   - **Validación:** Compara el código ingresado en el login contra la tabla CodigoFamiliar.

3. **Autenticación de Terminales Kiosco de Garita (lib/terminal-auth.ts):**
   - **Protocolo:** Autenticación por hardware/dispositivo mediante cabeceras HTTP personalizadas x-terminal-id y x-terminal-token.
   - **Criptografía:** Hash SHA-256 (crypto.createHash( sha256)). Se compara contra Terminal.tokenHash usando comparación en tiempo constante (crypto.timingSafeEqual) para evitar ataques de temporización (*timing attacks*).
   - **Comportamiento:** Si la terminal está registrada y en estado ACTIVA, se le otorga un contexto de sesión equivalente al rol PERSONAL.

4. **Autenticación de Automatizaciones y Cron Jobs (lib/cronAuth.ts):**
   - **Protocolo:** Bearer Token en la cabecera Authorization: Bearer <CRON_SECRET>.
   - **Validación:** Permite la ejecución automatizada desde el planificador de Vercel Cron.

---

### 5. BASE DE DATOS Y ORM UTILIZADOS

- **Motor:** PostgreSQL v16 desplegado en la infraestructura serverless de **Neon Cloud** (región AWS US-East-1).
- **Conectividad:** Pooler de conexiones transaccionales mediante cadena de conexión SSL (sslmode=require&channel_binding=require).
- **ORM:** Prisma ORM 7.8.0 configurado con adaptador nativo @prisma/adapter-pg.
- **Generación de Clientes:** Salida configurada en pp/generated/prisma/client.
- **Modelos:** 20 modelos relacionales completamente normalizados (ver Documento 05).

---

### 6. ESTRUCTURA DE CARPETAS DEL PROYECTO

`
sistema-asistencia/
├── .env                              # Variables de entorno locales (credenciales y llaves)
├── .gitignore                        # Reglas de exclusión de Git (incluye .env*, .next, etc.)
├── AGENTS.md                         # Reglas de desarrollo e instrucciones de Next.js 16
├── package.json                      # Definición de dependencias y scripts de compilación
├── next.config.ts                    # Configuración de Next.js (Turbopack, remotePatterns Blob)
├── proxy.ts                          # Proxy perimetral de Next.js 16 (reemplazo de middleware.ts)
├── vercel.json                       # Definición de despliegue y planificador Vercel Cron
├── prisma/
│   └── schema.prisma                 # Esquema relacional declarativo (20 modelos)
├── app/                              # Rutas y páginas de Next.js App Router
│   ├── api/                          # 33 grupos de Route Handlers (APIs REST)
│   ├── dashboard/                    # Vistas administrativas y de monitoreo
│   ├── marcar/                       # Interfaz quiosco de portería (asistencia)
│   ├── portal-padres/                # Interfaz web para padres y apoderados
│   ├── login/                        # Pantalla de acceso institucional con Three.js
│   ├── inicio/                       # Pantalla de selección de acceso
│   └── page.tsx                      # Landing institucional y acceso público
├── components/                       # Componentes reutilizables de UI
│   ├── asistencia/                   # Componentes de quiosco y escáner
│   ├── auth/                         # Guardas visuales de roles
│   ├── dashboard/                    # Gráficos y tarjetas KPI
│   ├── publico/                      # Escudo 3D (Three.js) y métricas públicas
│   └── ui/                           # Modales, botones e interfaces base
├── lib/                              # Librerías centrales y utilidades de backend
│   ├── auth.ts                       # Gestión de JWT, cookies y roles administrativos
│   ├── auth-padres.ts                # Gestión de JWT para familias
│   ├── aws-rekognition.ts            # Cliente y métodos de AWS Rekognition
│   ├── clasificadorAsistencia.ts     # Evaluador de puntualidad unificado
│   ├── supermotor.ts                 # Máquina de estados del SuperMotor
│   ├── supermotor-guard.ts           # Interceptores y auditoría de bloqueo
│   ├── tenant.ts                     # Resolutor de contexto multi-colegio
│   ├── terminal-auth.ts              # Autenticación SHA-256 para garita
│   ├── timezone.ts                   # Normalización horaria Perú (America/Lima)
│   └── events/eventBus.ts            # Bus de eventos Server-Sent Events (SSE)
├── services/                         # Servicios de integración externa y cron
│   ├── automatizaciones/             # Motor de alertas y reloj escolar
│   ├── jornada/                      # Evaluador automático de apertura/cierre
│   ├── groqService.ts                # Conector IA LLaMA 3.1
│   ├── whatsapp.ts                   # Conector Meta Graph API WhatsApp
│   └── alertaService.ts              # Despachador de alertas de ausentismo
├── docs/                             # Documentación técnica y auditoría
│   └── auditoria-sistema/            # Los 12 documentos de la auditoría integral
└── scripts/                          # Scripts de utilidades y migración offline
`

---

### 7. CATÁLOGO DE APIS Y ENDPOINTS IMPLEMENTADOS

El sistema cuenta con **33 grupos de endpoints** en pp/api/:

| Ruta de API | Métodos | Descripción y Objetivo |
| :--- | :---: | :--- |
| /api/asistencias | GET, POST | Consulta y marcación transaccional de asistencia (QR, DNI, Facial). |
| /api/asistencias/foto | POST | Subida de evidencias fotográficas capturadas en garita a Vercel Blob. |
| /api/alertas/ausentes | GET | Disparo manual o por cron del ciclo de alertas a tutores. |
| /api/ausentes | GET | Listado consolidado de estudiantes ausentes del día con filtros. |
| /api/auth/sesion | GET | Comprobación de sesión activa y obtención de datos del usuario autenticado. |
| /api/automatizaciones | GET, POST | Configuración y ejecución manual del motor de alertas escalonadas. |
| /api/backup | GET | Generación y descarga del respaldo de base de datos en formato JSON. |
| /api/backup/restaurar | POST | Carga y restauración transaccional de respaldo JSON. |
| /api/biometria/reconocer | POST | Búsqueda de similitud facial contra la colección AWS Rekognition. |
| /api/biometria/estudiantes | GET, POST, DELETE | Vinculación, desvinculación y consulta de descriptores biométricos. |
| /api/biometria/preparar-coleccion | POST | Inicialización y verificación de la colección en AWS. |
| /api/calendario-escolar | GET, POST, PUT, DELETE | CRUD de feriados, semanas de gestión y suspensiones de clases. |
| /api/configuracion | GET, PUT | Parametrización institucional (canales activos, director, horarios). |
| /api/configuracion/logo | POST | Carga de logo institucional oficial a Vercel Blob. |
| /api/configuracion/publica | GET | Datos públicos institucionales para el login y portal exterior. |
| /api/cron/automatizaciones | GET | Endpoint principal invocado por Vercel Cron para tareas automáticas. |
| /api/dashboard | GET | Consolidación analítica masiva (KPIs, turnos, gráficos, ausentes, IA). |
| /api/desarrollador/reiniciar-sistema| POST | Reinicio destructivo de datos operativos del sistema. |
| /api/estudiantes | GET, POST, PUT, DELETE | CRUD integral de fichas de alumnos. |
| /api/estudiantes/importar | POST | Importación masiva de estudiantes desde sábanas Excel (.xlsx). |
| /api/evidencias-fotograficas| GET, POST | Trazabilidad del ciclo de vida de fotos de portería. |
| /api/health | GET | Diagnóstico de salud en tiempo real de DB, SuperMotor, Cron, Cloud. |
| /api/ia/riesgo-estudiante | POST | Evaluación predictiva de riesgo de abandono escolar con Groq LLaMA. |
| /api/inteligencia-institucional | GET, POST | Diagnóstico institucional global generado por IA. |
| /api/login | POST | Autenticación de personal administrativo y emisión de cookie JWT. |
| /api/logout | POST | Invalidación y destrucción de cookie de sesión. |
| /api/padres | GET, POST, PUT, DELETE | Gestión administrativa de Códigos Familiares y apoderados. |
| /api/padres/generar-masivo | POST | Asignación automática de códigos familiares a hermanos. |
| /api/portal-padres/login | POST | Autenticación de apoderados mediante Código Familiar. |
| /api/portal-padres/datos | GET | Consulta de asistencias, fotos y alertas de los hijos del tutor. |
| /api/publica/asistencia | GET | Métricas públicas en vivo de asistencia para pantalla de acceso. |
| /api/realtime/events | GET | Canal Server-Sent Events (SSE) para actualización en vivo. |
| /api/reportes/estudiante | GET | Generación de reporte individual consolidado en PDF o Excel. |
| /api/reportes/mensual | GET | Matriz mensual de asistencia por grado y sección. |
| /api/reportes/telegram-diario| GET | Generación y despacho automático de PDF/Excel al Telegram del Director. |
| /api/reportes/padres-semanal | POST | Despacho programado de resúmenes semanales a familias. |
| /api/salidas-excepcionales | GET, POST | Registro y autorización de retiros prematuros de alumnos. |
| /api/supermotor | GET, PUT | Consulta y cambio de estado del SuperMotor e interruptores de módulos. |
| /api/tardanzas | GET | Reporte filtrado de tardanzas con cálculo de minutos de retraso. |
| /api/terminales | GET, POST, PUT, DELETE | Registro y revocación de terminales y tokens de garita. |
| /api/turnos | GET, POST, PUT, DELETE | Configuración de jornadas escolares, horarios y tolerancias. |
| /api/usuarios | GET, POST, PUT, DELETE | Administración de credenciales y roles de personal. |

---

### 8. SERVICIOS EXTERNOS CONECTADOS

1. **Neon Cloud PostgreSQL:** Persistencia relacional con pool de conexiones en Virginia (us-east-1).
2. **AWS Rekognition:** Reconocimiento biométrico facial en la colección santa-rita-estudiantes.
3. **Groq Cloud API:** Inferencia del modelo LLaMA 3.1 8B Instant para analítica y alertas escolares.
4. **Google GenAI (Gemini):** Servicio configurado como alternativa secundaria de IA.
5. **Vercel Blob Storage:** Almacenamiento seguro de objetos multimedia (fotos tomadas en garita).
6. **Telegram Bot API:** Despacho de notificaciones a apoderados y envío de archivos PDF/Excel al Director.
7. **Meta WhatsApp Business API:** Despacho de mensajes transaccionales de entrada y salida a tutores.

---

### 9. VARIABLES DE ENTORNO REQUERIDAS

| Variable de Entorno | Clasificación | Propósito Técnico |
| :--- | :--- | :--- |
| DATABASE_URL | Secreto Crítico | Conexión a la base de datos Neon PostgreSQL con SSL. |
| AUTH_SECRET | Secreto Crítico | Clave simétrica de 256 bits para firma y verificación de JWT. |
| CRON_SECRET | Secreto Crítico | Token Bearer para autorizar ejecuciones de Vercel Cron. |
| AWS_ACCESS_KEY_ID | Secreto Alto | Credencial de autenticación IAM para AWS Rekognition. |
| AWS_SECRET_ACCESS_KEY | Secreto Crítico | Clave privada de autenticación IAM para AWS Rekognition. |
| AWS_REGION | Configuración | Región AWS de la colección (us-east-1). |
| AWS_REKOGNITION_COLLECTION_ID | Configuración | Nombre de la colección facial (santa-rita-estudiantes). |
| AWS_REKOGNITION_MIN_SIMILARITY | Parámetro | Umbral mínimo de similitud facial (valor por defecto: 97). |
| GROQ_API_KEY | Secreto Alto | Llave de API para inferencia en Groq SDK. |
| GEMINI_API_KEY | Secreto Alto | Llave de API para inferencia en Google GenAI SDK. |
| BLOB_READ_WRITE_TOKEN | Secreto Crítico | Token de acceso de lectura/escritura a Vercel Blob Storage. |
| BLOB_STORE_ID | Configuración | Identificador de almacenamiento de Vercel Blob. |
| TELEGRAM_BOT_TOKEN | Secreto Alto | Token del bot de Telegram para envío de mensajes y archivos. |
| TELEGRAM_ENABLED | Conmutador | Interruptor de activación del servicio Telegram (	rue/alse). |
| TELEGRAM_DIRECTOR_CHAT_ID | Parámetro | Chat ID oficial de la dirección para resúmenes automáticos. |
| WHATSAPP_ENABLED | Conmutador | Interruptor de activación del servicio WhatsApp (	rue/alse). |
| WHATSAPP_TOKEN | Secreto Crítico | Token Bearer de la API de WhatsApp Business Cloud. |
| WHATSAPP_PHONE_NUMBER_ID | Parámetro | Identificador del número de teléfono remitente en Meta. |
| APP_URL | Configuración | URL canónica de la aplicación para enlaces internos. |

---

### 10. CONFIGURACIÓN DE DESPLIEGUE Y CRON JOBS

- **Plataforma de Despliegue:** Vercel Cloud Platform.
- **Configuración (ercel.json):**
  `json
  {
    crons: [
      {
        path: /api/cron/automatizaciones,
        schedule: 0 6 * * 1-5
      }
    ]
  }
  `
- **Frecuencia del Cron en Producción:** Se ejecuta de lunes a viernes a las 06:00 UTC (01:00 AM hora de Perú).
- **Procesamiento de Crons:** El endpoint /api/cron/automatizaciones evalúa el estado del SuperMotor y del colegio. Si el motor está activo y la jornada escolar abierta, ejecuta escalonadamente las alertas de ausentismo y el despacho de resúmenes semanales o mensuales.

---
*Fin del Documento 02: Arquitectura General del Sistema.*
