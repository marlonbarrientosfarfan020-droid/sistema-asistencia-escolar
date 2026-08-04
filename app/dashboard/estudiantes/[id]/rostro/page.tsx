"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Estudiante = {
  id: number;
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
  estado: boolean;

  turno: {
    id: number;
    nombre: string;
  } | null;
};

type RespuestaEstudiante = {
  ok?: boolean;
  message?: string;
  estudiante?: Estudiante;
};

type RespuestaRegistro = {
  ok?: boolean;
  message?: string;

  biometria?: {
    id?: number;
    faceId: string;
    imageId?: string | null;
    externalImageId: string;
    confianza: number | null;
    estado?: boolean;
    proveedor?: string;
    collectionId?: string;
    rostrosRegistrados?: number;
    ultimaActualizacionAt?: string;
  };

  biometriaGuardada?: {
    id: number;
    estado: boolean;
    rostrosRegistrados: number;
  };
};

type CamaraDisponible = {
  deviceId: string;
  label: string;
};

const STORAGE_CAMARA_REGISTRO_ROSTRO =
  "camara_registro_rostro_device_id";

export default function RegistrarRostroPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    use(params);

  const router =
    useRouter();

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const [estudiante, setEstudiante] =
    useState<Estudiante | null>(
      null
    );

  const [cargando, setCargando] =
    useState(true);

  const [camaraActiva, setCamaraActiva] =
    useState(false);

  const [
    registrando,
    setRegistrando,
  ] = useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    fotoCapturada,
    setFotoCapturada,
  ] = useState("");

  const [
    resultadoBiometria,
    setResultadoBiometria,
  ] = useState<{
    faceId: string;
    confianza: number | null;
    guardadoNeon: boolean;
    rostrosRegistrados: number;
  } | null>(null);

  const [camaras, setCamaras] =
    useState<CamaraDisponible[]>([]);

  const [
    camaraSeleccionada,
    setCamaraSeleccionada,
  ] = useState("");

  const [
    cargandoCamaras,
    setCargandoCamaras,
  ] = useState(false);

  useEffect(() => {
    cargarEstudiante();
    void cargarCamaras();

    const actualizarCamaras = () => {
      void cargarCamaras();
    };

    navigator.mediaDevices?.addEventListener(
      "devicechange",
      actualizarCamaras
    );

    return () => {
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        actualizarCamaras
      );

      detenerCamara();
    };
  }, [id]);

  function nombreCamara(
    dispositivo: MediaDeviceInfo,
    indice: number
  ) {
    return (
      dispositivo.label.trim() ||
      `Cámara ${indice + 1}`
    );
  }

  function elegirCamaraPredeterminada(
    dispositivos: CamaraDisponible[],
    preferencia: string
  ) {
    if (
      preferencia &&
      dispositivos.some(
        (camara) =>
          camara.deviceId ===
          preferencia
      )
    ) {
      return preferencia;
    }

    const palabrasPreferidas = [
      "back",
      "rear",
      "environment",
      "trasera",
      "front",
      "user",
      "facetime",
      "webcam",
      "integrated",
      "frontal",
    ];

    const encontrada =
      dispositivos.find((camara) =>
        palabrasPreferidas.some(
          (palabra) =>
            camara.label
              .toLowerCase()
              .includes(palabra)
        )
      );

    return (
      encontrada?.deviceId ||
      dispositivos[0]?.deviceId ||
      ""
    );
  }

  async function cargarCamaras() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .enumerateDevices
    ) {
      return;
    }

    setCargandoCamaras(true);

    let streamTemporal:
      | MediaStream
      | null = null;

    try {
      const iniciales =
        await navigator.mediaDevices
          .enumerateDevices();

      const hayEtiquetas =
        iniciales.some(
          (dispositivo) =>
            dispositivo.kind ===
              "videoinput" &&
            Boolean(
              dispositivo.label
            )
        );

      if (!hayEtiquetas) {
        try {
          streamTemporal =
            await navigator.mediaDevices
              .getUserMedia({
                video: true,
                audio: false,
              });
        } catch {
          // Se usarán nombres genéricos si aún no hay permiso.
        }
      }

      const dispositivos =
        await navigator.mediaDevices
          .enumerateDevices();

      const camarasEncontradas =
        dispositivos
          .filter(
            (dispositivo) =>
              dispositivo.kind ===
              "videoinput"
          )
          .map(
            (
              dispositivo,
              indice
            ) => ({
              deviceId:
                dispositivo.deviceId,

              label:
                nombreCamara(
                  dispositivo,
                  indice
                ),
            })
          );

      setCamaras(
        camarasEncontradas
      );

      const guardada =
        localStorage.getItem(
          STORAGE_CAMARA_REGISTRO_ROSTRO
        ) || "";

      setCamaraSeleccionada(
        elegirCamaraPredeterminada(
          camarasEncontradas,
          guardada
        )
      );
    } catch (error) {
      console.error(
        "Error detectando cámaras:",
        error
      );

      setMensaje(
        "⚠️ No se pudieron listar las cámaras. Se usará la cámara predeterminada."
      );
    } finally {
      streamTemporal
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      setCargandoCamaras(false);
    }
  }

  function seleccionarCamara(
    deviceId: string
  ) {
    setCamaraSeleccionada(
      deviceId
    );

    localStorage.setItem(
      STORAGE_CAMARA_REGISTRO_ROSTRO,
      deviceId
    );
  }

  async function cambiarCamara() {
    if (camaras.length <= 1) {
      setMensaje(
        "ℹ️ Solo se detectó una cámara en este dispositivo."
      );

      return;
    }

    const indiceActual =
      camaras.findIndex(
        (camara) =>
          camara.deviceId ===
          camaraSeleccionada
      );

    const siguienteIndice =
      indiceActual >= 0
        ? (indiceActual + 1) %
          camaras.length
        : 0;

    const siguiente =
      camaras[siguienteIndice];

    seleccionarCamara(
      siguiente.deviceId
    );

    if (camaraActiva) {
      detenerCamara();

      await new Promise<void>(
        (resolve) => {
          window.setTimeout(
            resolve,
            300
          );
        }
      );

      await activarCamara(
        siguiente.deviceId
      );
    } else {
      setMensaje(
        `✅ Cámara seleccionada: ${siguiente.label}`
      );
    }
  }

  async function cargarEstudiante() {
    setCargando(true);
    setError("");

    try {
      const respuesta =
        await fetch(
          `/api/biometria/estudiantes/${id}/rostro`,
          {
            method: "GET",
            cache: "no-store",
            credentials:
              "include",
          }
        );

      const data =
        (await respuesta.json()) as RespuestaEstudiante;

      if (
        !respuesta.ok ||
        !data.estudiante
      ) {
        throw new Error(
          data.message ||
            "No se pudo obtener el estudiante"
        );
      }

      setEstudiante(
        data.estudiante
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el estudiante"
      );
    } finally {
      setCargando(false);
    }
  }

  async function activarCamara(
    deviceId = camaraSeleccionada
  ) {
    setError("");
    setMensaje("");
    setFotoCapturada("");
    setResultadoBiometria(null);

    try {
      detenerCamara();

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Este navegador no permite utilizar la cámara"
        );
      }

      let stream: MediaStream;

      try {
        stream =
          await navigator.mediaDevices.getUserMedia({
            video: deviceId
              ? {
                  deviceId: {
                    exact: deviceId,
                  },
                  width: {
                    ideal: 1280,
                  },
                  height: {
                    ideal: 720,
                  },
                }
              : {
                  width: {
                    ideal: 1280,
                  },
                  height: {
                    ideal: 720,
                  },
                },
            audio: false,
          });
      } catch {
        stream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
      }

      const pistaVideo =
        stream.getVideoTracks()[0];

      const configuracionPista =
        pistaVideo?.getSettings();

      if (
        configuracionPista?.deviceId
      ) {
        seleccionarCamara(
          configuracionPista.deviceId
        );
      }

      if (!pistaVideo) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        throw new Error(
          "No se encontró una cámara disponible"
        );
      }

      streamRef.current = stream;
      setCamaraActiva(true);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const video = videoRef.current;

      if (!video) {
        throw new Error(
          "No se encontró el reproductor de la cámara"
        );
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(
            new Error(
              "La cámara respondió, pero no entregó imagen"
            )
          );
        }, 8000);

        video.onloadedmetadata = async () => {
          window.clearTimeout(timeout);

          try {
            await video.play();
            resolve();
          } catch (error) {
            reject(error);
          }
        };
      });

      setMensaje(
        `✅ Cámara activada: ${pistaVideo.label || "cámara integrada"}. Mire de frente y mantenga el rostro centrado.`
      );
    } catch (error) {
      console.error(
        "Error activando cámara:",
        error
      );

      detenerCamara();

      const nombreError =
        error instanceof DOMException
          ? error.name
          : "";

      let mensajeError =
        error instanceof Error
          ? error.message
          : "No se pudo acceder a la cámara";

      if (
        nombreError === "NotAllowedError" ||
        nombreError === "SecurityError"
      ) {
        mensajeError =
          "Chrome no tiene permiso para usar la cámara. Active el permiso desde el ícono junto a localhost.";
      }

      if (
        nombreError === "NotReadableError" ||
        nombreError === "TrackStartError"
      ) {
        mensajeError =
          "La cámara está siendo usada por otra aplicación o está bloqueada por Windows.";
      }

      if (
        nombreError === "NotFoundError" ||
        nombreError === "DevicesNotFoundError"
      ) {
        mensajeError =
          "Windows no detecta ninguna cámara disponible.";
      }

      setError(mensajeError);
    }
  }

  function detenerCamara() {
    const stream = streamRef.current;

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    const video = videoRef.current;

    if (video) {
      video.pause();
      video.srcObject = null;
      video.onloadedmetadata = null;
    }

    setCamaraActiva(false);
  }

  function esCamaraFrontal() {
    const camara =
      camaras.find(
        (item) =>
          item.deviceId ===
          camaraSeleccionada
      );

    const etiqueta =
      camara?.label
        .toLowerCase() || "";

    return [
      "front",
      "user",
      "facetime",
      "webcam",
      "integrated",
      "frontal",
    ].some((palabra) =>
      etiqueta.includes(
        palabra
      )
    );
  }

  function capturarFoto() {
    setError("");
    setMensaje("");

    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas ||
      !camaraActiva
    ) {
      setError(
        "Primero debe activar la cámara"
      );

      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setError(
        "La cámara todavía no está lista"
      );

      return;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const contexto =
      canvas.getContext("2d");

    if (!contexto) {
      setError(
        "No se pudo capturar la fotografía"
      );

      return;
    }

    if (esCamaraFrontal()) {
      contexto.save();

      contexto.translate(
        canvas.width,
        0
      );

      contexto.scale(
        -1,
        1
      );

      contexto.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      contexto.restore();
    } else {
      contexto.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    const imagen =
      canvas.toDataURL(
        "image/jpeg",
        0.9
      );

    setFotoCapturada(
      imagen
    );

    setMensaje(
      "📷 Fotografía capturada. Revísela antes de registrar el rostro."
    );
  }

  function convertirDataUrlABlob(
    dataUrl: string
  ) {
    const partes =
      dataUrl.split(",");

    const encabezado =
      partes[0];

    const contenido =
      partes[1];

    const tipo =
      encabezado
        .match(
          /data:(.*?);base64/
        )?.[1] ||
      "image/jpeg";

    const binario =
      atob(contenido);

    const bytes =
      new Uint8Array(
        binario.length
      );

    for (
      let indice = 0;
      indice <
      binario.length;
      indice++
    ) {
      bytes[indice] =
        binario.charCodeAt(
          indice
        );
    }

    return new Blob(
      [bytes],
      {
        type: tipo,
      }
    );
  }

  async function registrarRostro() {
    if (!fotoCapturada) {
      setError(
        "Debe capturar una fotografía primero"
      );

      return;
    }

    setRegistrando(true);
    setError("");

    setMensaje(
      "🧠 AWS está analizando y registrando el rostro..."
    );

    try {
      const fotoBlob =
        convertirDataUrlABlob(
          fotoCapturada
        );

      const formData =
        new FormData();

      formData.append(
        "foto",
        fotoBlob,
        `rostro-estudiante-${id}.jpg`
      );

      const respuesta =
        await fetch(
          `/api/biometria/estudiantes/${id}/rostro`,
          {
            method: "POST",
            credentials:
              "include",
            body: formData,
          }
        );

      const data =
        (await respuesta.json()) as RespuestaRegistro;

      if (
        !respuesta.ok ||
        !data.ok ||
        !data.biometria
      ) {
        throw new Error(
          data.message ||
            "No se pudo registrar el rostro"
        );
      }

      const guardadoNeon =
        Boolean(
          data.biometriaGuardada ||
          data.biometria.id
        );

      const rostrosRegistrados =
        data.biometriaGuardada
          ?.rostrosRegistrados ??
        data.biometria
          .rostrosRegistrados ??
        1;

      setResultadoBiometria({
        faceId:
          data.biometria.faceId,

        confianza:
          data.biometria
            .confianza,

        guardadoNeon,

        rostrosRegistrados,
      });

      setMensaje(
        guardadoNeon
          ? "✅ Rostro registrado en AWS Rekognition y guardado correctamente en Neon"
          : "⚠️ AWS registró el rostro, pero la API no confirmó el guardado en Neon"
      );

      detenerCamara();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el rostro"
      );

      setMensaje("");
    } finally {
      setRegistrando(false);
    }
  }

  function repetirFoto() {
    setFotoCapturada("");
    setResultadoBiometria(null);
    setMensaje(
      "Mire de frente y capture nuevamente la fotografía."
    );
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xl font-bold">
            Cargando estudiante...
          </p>
        </div>
      </main>
    );
  }

  if (
    error &&
    !estudiante
  ) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-950/40 p-8">
          <h1 className="text-2xl font-black">
            No se pudo abrir el registro facial
          </h1>

          <p className="mt-4 text-red-200">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/estudiantes"
              )
            }
            className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-slate-900"
          >
            Volver a estudiantes
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
              Biometría facial
            </p>

            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              🙂 Registrar rostro
            </h1>

            <p className="mt-2 text-slate-300">
              El rostro será asociado al estudiante dentro de AWS Rekognition.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/estudiantes"
              )
            }
            className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-bold hover:bg-white/20"
          >
            ← Volver a estudiantes
          </button>
        </header>

        {estudiante && (
          <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-600 text-4xl shadow-xl">
                👨‍🎓
              </div>

              <h2 className="mt-5 text-2xl font-black">
                {estudiante.nombres}{" "}
                {estudiante.apellidos}
              </h2>

              <div className="mt-6 space-y-3 text-sm">
                <Dato
                  etiqueta="DNI"
                  valor={
                    estudiante.dni
                  }
                />

                <Dato
                  etiqueta="Código"
                  valor={
                    estudiante.codigo
                  }
                />

                <Dato
                  etiqueta="Grado y sección"
                  valor={`${estudiante.grado} - ${estudiante.seccion}`}
                />

                <Dato
                  etiqueta="Turno"
                  valor={
                    estudiante.turno
                      ?.nombre ||
                    "Sin turno"
                  }
                />
              </div>

              <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                <p className="font-black">
                  Recomendaciones
                </p>

                <p className="mt-2">
                  Una sola persona en la imagen, rostro frontal, sin gorra y con iluminación uniforme.
                </p>
              </div>
            </aside>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:p-7">
              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <label>
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Cámara para registrar rostro
                  </span>

                  <select
                    value={
                      camaraSeleccionada
                    }
                    onChange={(event) =>
                      seleccionarCamara(
                        event.target.value
                      )
                    }
                    disabled={
                      camaraActiva ||
                      registrando ||
                      cargandoCamaras
                    }
                    className="mt-2 h-12 w-full rounded-2xl border border-cyan-400/30 bg-slate-950/70 px-4 font-bold text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                  >
                    {camaras.length ===
                    0 ? (
                      <option value="">
                        Cámara predeterminada
                      </option>
                    ) : (
                      camaras.map(
                        (camara) => (
                          <option
                            key={
                              camara.deviceId
                            }
                            value={
                              camara.deviceId
                            }
                          >
                            {
                              camara.label
                            }
                          </option>
                        )
                      )
                    )}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    void cargarCamaras()
                  }
                  disabled={
                    camaraActiva ||
                    registrando ||
                    cargandoCamaras
                  }
                  className="self-end rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
                >
                  {cargandoCamaras
                    ? "Buscando..."
                    : "🔄 Actualizar"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void cambiarCamara()
                  }
                  disabled={
                    registrando ||
                    cargandoCamaras ||
                    camaras.length <= 1
                  }
                  className="self-end rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 font-black text-violet-100 hover:bg-violet-400/20 disabled:opacity-50"
                >
                  🔁 Cambiar cámara
                </button>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-3xl border border-cyan-400/20 bg-black">
                {!fotoCapturada && (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={
                      esCamaraFrontal()
                        ? "h-full w-full scale-x-[-1] object-cover"
                        : "h-full w-full object-cover"
                    }
                  />
                )}

                {fotoCapturada && (
                  <img
                    src={
                      fotoCapturada
                    }
                    alt="Fotografía facial capturada"
                    className="h-full w-full object-cover"
                  />
                )}

                {!camaraActiva &&
                  !fotoCapturada && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-center">
                      <div className="text-7xl">
                        📷
                      </div>

                      <p className="mt-4 text-xl font-black">
                        Cámara desactivada
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        Presione el botón para comenzar.
                      </p>
                    </div>
                  )}

                {camaraActiva &&
                  !fotoCapturada && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[72%] w-[44%] rounded-[45%] border-4 border-cyan-400 shadow-[0_0_45px_rgba(34,211,238,0.45)]" />
                    </div>
                  )}

                {resultadoBiometria && (
                  <div className="absolute inset-x-0 bottom-0 bg-emerald-950/95 p-5 shadow-2xl">
                    <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-4xl text-slate-950">
                        ✅
                      </div>

                      <div>
                        <h3 className="text-2xl font-black text-white">
                          Rostro registrado correctamente
                        </h3>

                        <p className="mt-1 text-emerald-200">
                          AWS Rekognition: confirmado
                        </p>

                        <p
                          className={
                            resultadoBiometria.guardadoNeon
                              ? "mt-1 text-emerald-200"
                              : "mt-1 text-amber-200"
                          }
                        >
                          Neon:{" "}
                          {resultadoBiometria.guardadoNeon
                            ? "guardado correctamente"
                            : "sin confirmación"}
                        </p>

                        <p className="mt-1 text-sm text-emerald-300">
                          Confianza de detección:{" "}
                          {resultadoBiometria.confianza !== null
                            ? resultadoBiometria.confianza.toFixed(
                                2
                              )
                            : "--"}
                          %
                        </p>

                        <p className="mt-1 text-sm text-emerald-300">
                          Rostros registrados para este estudiante:{" "}
                          {resultadoBiometria.rostrosRegistrados}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                🎥 Cámara seleccionada:{" "}
                <span className="font-black text-white">
                  {
                    camaras.find(
                      (camara) =>
                        camara.deviceId ===
                        camaraSeleccionada
                    )?.label ||
                    "Predeterminada"
                  }
                </span>
              </div>

              <canvas
                ref={canvasRef}
                className="hidden"
              />

              {mensaje && (
                <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 font-bold text-cyan-100">
                  {mensaje}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 font-bold text-red-100">
                  ❌ {error}
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {!camaraActiva &&
                  !fotoCapturada &&
                  !resultadoBiometria && (
                   <button
  type="button"
  onClick={() => void activarCamara()}
  className="rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-500"
>
  📷 Activar cámara
</button>
                  )}

                {camaraActiva &&
                  !fotoCapturada && (
                    <button
                      type="button"
                      onClick={
                        capturarFoto
                      }
                      className="rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 hover:bg-cyan-400"
                    >
                      📸 Capturar rostro
                    </button>
                  )}

                {fotoCapturada &&
                  !resultadoBiometria && (
                    <>
                      <button
                        type="button"
                        onClick={
                          repetirFoto
                        }
                        disabled={
                          registrando
                        }
                        className="rounded-2xl bg-slate-700 px-5 py-4 font-black hover:bg-slate-600 disabled:opacity-50"
                      >
                        🔄 Repetir foto
                      </button>

                      <button
                        type="button"
                        onClick={
                          registrarRostro
                        }
                        disabled={
                          registrando
                        }
                        className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {registrando
                          ? "Registrando..."
                          : "✅ Registrar en AWS + Neon"}
                      </button>
                    </>
                  )}

                {(camaraActiva ||
                  fotoCapturada) &&
                  !resultadoBiometria && (
                    <button
                      type="button"
                      onClick={() => {
                        detenerCamara();
                        setFotoCapturada(
                          ""
                        );
                        setMensaje(
                          ""
                        );
                        setError("");
                      }}
                      disabled={
                        registrando
                      }
                      className="rounded-2xl bg-red-600 px-5 py-4 font-black hover:bg-red-500 disabled:opacity-50"
                    >
                      ✕ Cancelar
                    </button>
                  )}

                {resultadoBiometria && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/dashboard/estudiantes"
                      )
                    }
                    className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950 hover:bg-emerald-400"
                  >
                    ✅ Finalizar
                  </button>
                )}
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {etiqueta}
      </p>

      <p className="mt-1 font-bold text-white">
        {valor}
      </p>
    </div>
  );
}