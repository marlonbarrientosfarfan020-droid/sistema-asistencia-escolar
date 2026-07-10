"use client";

import { useEffect, useState } from "react";

type AnalisisIA = {
  id: number;
  tipo: string;
  dni: string | null;
  resultado: string;
  createdAt: string;
};

export default function HistorialInteligenciaPage() {
  const [historial, setHistorial] = useState<AnalisisIA[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<AnalisisIA | null>(null);

  async function cargarHistorial() {
    setCargando(true);

    const res = await fetch("/api/ia/historial");
    const data = await res.json();

    if (data.ok) {
      setHistorial(data.historial);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargarHistorial();
  }, []);

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function limpiarTexto(texto: string) {
    return texto.replaceAll("**", "").replaceAll("\\n", "\n").trim();
  }

  function exportarPDF(item: AnalisisIA) {
    const contenido = limpiarTexto(item.resultado);
    const ventana = window.open("", "_blank");

    if (!ventana) return;

    ventana.document.write(`
      <html>
        <head>
          <title>Reporte IA</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              line-height: 1.6;
              color: #111827;
            }
            h1 {
              color: #1e3a8a;
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 10px;
            }
            .info {
              margin-bottom: 25px;
              background: #f1f5f9;
              padding: 15px;
              border-radius: 10px;
            }
            pre {
              white-space: pre-wrap;
              font-family: Arial, sans-serif;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>Reporte de Análisis Inteligente de Asistencia</h1>

          <div class="info">
            <p><strong>Institución:</strong> I.E. Santa Rita de Casia</p>
            <p><strong>Tipo:</strong> ${
              item.tipo === "GENERAL"
                ? "Análisis general"
                : "Análisis individual"
            }</p>
            <p><strong>DNI:</strong> ${item.dni || "No aplica"}</p>
            <p><strong>Fecha:</strong> ${formatearFecha(item.createdAt)}</p>
            <p><strong>Motor IA:</strong> Groq</p>
          </div>

          <pre>${contenido}</pre>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);

    ventana.document.close();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white rounded-3xl p-8 shadow">
        <h1 className="text-4xl font-extrabold mb-2">
          📚 Historial de Análisis IA
        </h1>
        <p className="text-blue-100">
          Consulta los análisis inteligentes generados por el sistema.
        </p>
      </div>

      {cargando && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 font-bold text-blue-700">
          Cargando historial...
        </div>
      )}

      {!cargando && historial.length === 0 && (
        <div className="bg-white rounded-2xl shadow p-6 text-slate-600">
          No hay análisis IA registrados todavía.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-3xl shadow p-5">
          <h2 className="text-2xl font-bold mb-4">Registros</h2>

          <div className="space-y-3 max-h-[650px] overflow-y-auto">
            {historial.map((item) => (
              <button
                key={item.id}
                onClick={() => setSeleccionado(item)}
                className={`w-full text-left border rounded-2xl p-4 hover:bg-blue-50 ${
                  seleccionado?.id === item.id
                    ? "border-blue-600 bg-blue-50"
                    : "bg-slate-50"
                }`}
              >
                <p className="font-bold">
                  {item.tipo === "GENERAL"
                    ? "🌐 Análisis general"
                    : "👤 Análisis individual"}
                </p>

                {item.dni && (
                  <p className="text-sm text-slate-600">DNI: {item.dni}</p>
                )}

                <p className="text-sm text-slate-500 mt-1">
                  {formatearFecha(item.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl shadow p-6">
          {!seleccionado ? (
            <div className="text-slate-500 text-center py-20">
              Selecciona un análisis para ver el detalle.
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">
                {seleccionado.tipo === "GENERAL"
                  ? "🌐 Análisis general"
                  : "👤 Análisis individual"}
              </h2>

              <p className="text-slate-500 mb-5">
                Fecha: {formatearFecha(seleccionado.createdAt)}
                {seleccionado.dni ? ` | DNI: ${seleccionado.dni}` : ""}
              </p>

              <button
                onClick={() => exportarPDF(seleccionado)}
                className="mb-5 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold"
              >
                📄 Exportar PDF
              </button>

              <div className="bg-slate-50 border rounded-2xl p-6 whitespace-pre-wrap leading-8">
                {limpiarTexto(seleccionado.resultado)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}