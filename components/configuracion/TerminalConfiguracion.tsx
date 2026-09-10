"use client";

import { useEffect, useRef, useState } from "react";
import {
  TerminalConfig,
  TipoDispositivoTerminal,
  CamaraDispositivo,
} from "@/types/terminal";
import {
  obtenerConfiguracionTerminal,
  guardarConfiguracionTerminal,
} from "@/lib/terminal-config";

export function TerminalConfiguracion() {
  const [config, setConfig] = useState<TerminalConfig>(obtenerConfiguracionTerminal);
  const [camaras, setCamaras] = useState<CamaraDispositivo[]>([]);
  const [cargandoCamaras, setCargandoCamaras] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState("");

  // Estados de validación de previsualización
  const [permisoConcedido, setPermisoConcedido] = useState(false);
  const [camaraFuncionando, setCamaraFuncionando] = useState(false);
  const [imagenRecibida, setImagenRecibida] = useState(false);
  const [errorCamara, setErrorCamara] = useState("");

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const cargada = obtenerConfiguracionTerminal();
    setConfig(cargada);
    void listarCamaras();

    return () => {
      detenerPreview();
    };
  }, []);

  // Al cambiar la cámara seleccionada o el modo preferido, reiniciar preview
  useEffect(() => {
    if (config.camaraSeleccionada || config.modoCamaraPreferido) {
      void iniciarPreview();
    }
  }, [config.camaraSeleccionada, config.modoCamaraPreferido]);

  function detenerPreview() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setCamaraFuncionando(false);
    setImagenRecibida(false);
  }

  async function listarCamaras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setCargandoCamaras(true);
    setErrorCamara("");

    try {
      // Solicitar stream breve si no hay permisos otorgados aún
      let tempStream: MediaStream | null = null;
      try {
        const devicesInitial = await navigator.mediaDevices.enumerateDevices();
        const hasLabels = devicesInitial.some((d) => d.kind === "videoinput" && Boolean(d.label));
        if (!hasLabels && navigator.mediaDevices.getUserMedia) {
          tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setPermisoConcedido(true);
        } else if (hasLabels) {
          setPermisoConcedido(true);
        }
      } catch (err) {
        console.warn("Permiso de cámara pendiente o denegado:", err);
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Cámara ${index + 1}`,
        }));

      setCamaras(videoDevices);

      if (tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }

      // Si no hay cámara seleccionada y hay dispositivos disponibles, seleccionar la más adecuada
      if (!config.camaraSeleccionada && videoDevices.length > 0) {
        const preferida = config.modoCamaraPreferido === "environment"
          ? videoDevices.find((c) => /back|rear|trasera|environment/i.test(c.label))?.deviceId || videoDevices.at(-1)?.deviceId
          : videoDevices.find((c) => /front|user|frontal|integrated/i.test(c.label))?.deviceId || videoDevices[0]?.deviceId;

        if (preferida) {
          setConfig((prev) => ({ ...prev, camaraSeleccionada: preferida }));
        }
      }
    } catch (err: any) {
      console.error("Error listando cámaras:", err);
      setErrorCamara("No se pudieron detectar las cámaras del dispositivo.");
    } finally {
      setCargandoCamaras(false);
    }
  }

  async function iniciarPreview() {
    detenerPreview();
    setErrorCamara("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorCamara("El navegador no soporta captura de video");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: config.camaraSeleccionada
          ? { deviceId: { exact: config.camaraSeleccionada }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: { ideal: config.modoCamaraPreferido }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermisoConcedido(true);
      setCamaraFuncionando(true);

      const video = videoPreviewRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        video.onloadeddata = () => {
          setImagenRecibida(true);
        };

        await video.play();
      }
    } catch (err: any) {
      console.error("Error iniciando previsualización:", err);
      setPermisoConcedido(false);
      setCamaraFuncionando(false);
      setImagenRecibida(false);
      setErrorCamara(
        err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Active los permisos en la barra del navegador."
          : `Error al conectar con la cámara (${err.message || "Dispositivo no disponible"})`
      );
    }
  }

  function handleCambioTipoDispositivo(tipo: TipoDispositivoTerminal) {
    const modo: "environment" | "user" = tipo === "TABLET_CELULAR" ? "environment" : "user";
    setConfig((prev) => ({
      ...prev,
      tipoDispositivo: tipo,
      modoCamaraPreferido: modo,
    }));
  }

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    const guardada = guardarConfiguracionTerminal(config);
    setConfig(guardada);
    setMensajeGuardado("✅ Configuración del terminal guardada correctamente");
    setTimeout(() => setMensajeGuardado(""), 4000);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider mb-2">
            <span>📷</span> Terminal de Asistencia Escolar
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Configuración de Terminal y Cámara
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure la identidad del punto de acceso (portería/puerta) y ajuste la cámara permanente para celular, tablet o laptop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {config.estadoTerminal}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {config.terminalId}
          </span>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="mt-6 space-y-8">
        {/* Identidad del Terminal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Identificador del Terminal
            </label>
            <input
              type="text"
              value={config.terminalId}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  terminalId: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                }))
              }
              placeholder="PUERTA_PRINCIPAL_01"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 uppercase"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Código único para trazabilidad y multi-terminal futuro.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Nombre del Terminal (Ubicación física)
            </label>
            <input
              type="text"
              value={config.nombreTerminal}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, nombreTerminal: e.target.value }))
              }
              placeholder="Puerta Principal"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Ej: Puerta Principal, Portería Secundaria, Pabellón Inicial.
            </p>
          </div>
        </div>

        {/* Tipo de Dispositivo */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Tipo de Dispositivo Físico
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleCambioTipoDispositivo("TABLET_CELULAR")}
              className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-4 ${
                config.tipoDispositivo === "TABLET_CELULAR"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-3xl">📱</span>
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  Celular / Tablet
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Optimizado para pantalla táctil en atril. Usa por defecto la cámara trasera (<code className="text-blue-600 font-mono">environment</code>).
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCambioTipoDispositivo("LAPTOP_PC")}
              className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-4 ${
                config.tipoDispositivo === "LAPTOP_PC"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-3xl">💻</span>
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  Laptop / PC de Escritorio
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Para escritorios de recepción con cámara web frontal o lector USB (<code className="text-blue-600 font-mono">user</code>).
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Preferencia de Orientación y Cámara */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Orientación de Cámara Preferida
            </label>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50">
                <input
                  type="radio"
                  name="modoCamaraPreferido"
                  value="environment"
                  checked={config.modoCamaraPreferido === "environment"}
                  onChange={() =>
                    setConfig((prev) => ({
                      ...prev,
                      modoCamaraPreferido: "environment",
                    }))
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  Trasera / Ambiente (Recomendada)
                </span>
              </label>

              <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50">
                <input
                  type="radio"
                  name="modoCamaraPreferido"
                  value="user"
                  checked={config.modoCamaraPreferido === "user"}
                  onChange={() =>
                    setConfig((prev) => ({
                      ...prev,
                      modoCamaraPreferido: "user",
                    }))
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  Frontal / Integrada
                </span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Cámara Específica Detectada
              </label>
              <button
                type="button"
                onClick={listarCamaras}
                disabled={cargandoCamaras}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>🔄</span> {cargandoCamaras ? "Detectando..." : "Actualizar"}
              </button>
            </div>

            <select
              value={config.camaraSeleccionada}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  camaraSeleccionada: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
            >
              <option value="">-- Detección Automática por Orientación --</option>
              {camaras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Seleccione una cámara fija o deje en detección automática.
            </p>
          </div>
        </div>

        {/* Sección de Previsualización en Vivo y Validación */}
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>📹</span> Previsualización en Vivo de Terminal
              </h3>
              <p className="text-xs text-slate-400">
                Valide el encuadre físico, la luminosidad y el flujo de video antes de enviar a portería.
              </p>
            </div>

            <button
              type="button"
              onClick={iniciarPreview}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition border border-slate-700"
            >
              <span>▶</span> Reiniciar Preview
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
            {/* Contenedor del video */}
            <div className="lg:col-span-2 relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {!camaraFuncionando && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/80">
                  <span className="text-3xl mb-2">📷</span>
                  <p className="text-xs font-bold text-slate-300">
                    {errorCamara || "Cámara inactiva en este momento"}
                  </p>
                  <button
                    type="button"
                    onClick={iniciarPreview}
                    className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow"
                  >
                    Activar Cámara de Prueba
                  </button>
                </div>
              )}
            </div>

            {/* Checklist de Validación */}
            <div className="space-y-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Diagnóstico del Sensor
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-xs font-semibold text-slate-200">
                  Permiso concedido
                </span>
                <span className={`text-xs font-black ${permisoConcedido ? "text-emerald-400" : "text-amber-400"}`}>
                  {permisoConcedido ? "✅ SÍ" : "⏳ PENDIENTE"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-xs font-semibold text-slate-200">
                  Cámara funcionando
                </span>
                <span className={`text-xs font-black ${camaraFuncionando ? "text-emerald-400" : "text-slate-400"}`}>
                  {camaraFuncionando ? "✅ ACTIVA" : "❌ INACTIVA"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-xs font-semibold text-slate-200">
                  Imagen recibida
                </span>
                <span className={`text-xs font-black ${imagenRecibida ? "text-emerald-400" : "text-slate-400"}`}>
                  {imagenRecibida ? "✅ FLUIDA" : "⏳ SIN STREAM"}
                </span>
              </div>

              {errorCamara && (
                <div className="p-2 rounded bg-red-950/60 border border-red-800 text-[11px] text-red-300">
                  {errorCamara}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Acciones de Guardado */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div>
            {mensajeGuardado && (
              <span className="text-sm font-bold text-emerald-700">
                {mensajeGuardado}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/marcar"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm transition"
            >
              🚀 Abrir Terminal /marcar
            </a>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-sm hover:shadow"
            >
              💾 Guardar Configuración de Terminal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
