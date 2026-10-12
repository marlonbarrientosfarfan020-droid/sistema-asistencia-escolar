"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MODULOS_OPERATIVOS,
  CATEGORIAS_MODULOS,
  MODULOS_POR_CATEGORIA,
  PLANTILLAS_ROLES,
  obtenerModulosPorRol,
  ModuloDefinicion,
} from "@/lib/modulos";

type Usuario = {
  id: number;
  usuario: string;
  rol: string;
  estado: boolean;
  colegioId?: string;
  createdAt: string;
  modulos: string[];
  totalModulos?: number;
};

export default function GestionUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [notificacion, setNotificacion] = useState<{
    tipo: "exito" | "error" | "info";
    mensaje: string;
  } | null>(null);

  // Filtros de tabla
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [usuarioAccesos, setUsuarioAccesos] = useState<Usuario | null>(null);

  // Formulario Crear / Editar General
  const [formUsuario, setFormUsuario] = useState({
    usuario: "",
    password: "",
    confirmarPassword: "",
    rol: "DOCENTE",
    estado: true,
  });

  // Estado de casillas de módulos para el modal activo (Crear o Administrar Accesos)
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([]);
  const [busquedaModulo, setBusquedaModulo] = useState("");
  const [pestanaAccesos, setPestanaAccesos] = useState<"casillas" | "preview">("casillas");
  const [usuarioOrigenCopia, setUsuarioOrigenCopia] = useState<string>("");

  const usuarioActualSesion = typeof window !== "undefined" ? localStorage.getItem("usuario") || "" : "";
  const rolActualSesion = typeof window !== "undefined" ? localStorage.getItem("rol") || "" : "";

  useEffect(() => {
    if (rolActualSesion && rolActualSesion !== "ADMIN" && rolActualSesion !== "SUPER_ADMIN") {
      window.location.replace("/dashboard/acceso-denegado");
      return;
    }
    cargarUsuarios();
  }, [rolActualSesion]);

  async function cargarUsuarios() {
    setCargando(true);
    try {
      const res = await fetch("/api/usuarios", {
        headers: { "x-user-role": rolActualSesion },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsuarios(data);
      } else {
        setUsuarios([]);
        mostrarNotificacion("error", data.message || "No se pudo cargar la lista de usuarios");
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  }

  function mostrarNotificacion(tipo: "exito" | "error" | "info", mensaje: string) {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => {
      setNotificacion(null);
    }, 4500);
  }

  // Usuarios filtrados para la tabla
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideTexto =
        u.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.rol.toLowerCase().includes(busqueda.toLowerCase());

      const coincideRol = filtroRol === "TODOS" || u.rol === filtroRol;
      const coincideEstado =
        filtroEstado === "TODOS" ||
        (filtroEstado === "ACTIVO" && u.estado) ||
        (filtroEstado === "INACTIVO" && !u.estado);

      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  // Métricas rápidas
  const metricas = useMemo(() => {
    const total = usuarios.length;
    const activos = usuarios.filter((u) => u.estado).length;
    const inactivos = total - activos;
    const conAccesoTotal = usuarios.filter((u) => (u.modulos?.length ?? 0) === MODULOS_OPERATIVOS.length).length;
    return { total, activos, inactivos, conAccesoTotal };
  }, [usuarios]);

  // Manejo de casillas de módulos
  function toggleModulo(id: string) {
    setModulosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function seleccionarTodos() {
    setModulosSeleccionados(MODULOS_OPERATIVOS.map((m) => m.id));
  }

  function quitarTodos() {
    // Si el usuario es ADMIN principal, evitar quitar "usuarios" para no bloquearse
    if (usuarioAccesos && usuarioAccesos.rol === "ADMIN" && usuarioAccesos.id === 1) {
      setModulosSeleccionados(["usuarios"]);
      mostrarNotificacion("info", "El administrador principal debe conservar el módulo Usuarios");
      return;
    }
    setModulosSeleccionados([]);
  }

  function aplicarPlantillaRol(rolKey: string) {
    const plantilla = PLANTILLAS_ROLES[rolKey];
    if (plantilla) {
      setModulosSeleccionados([...plantilla.modulos]);
      mostrarNotificacion("info", `Plantilla "${plantilla.etiqueta}" aplicada (${plantilla.modulos.length} módulos)`);
    } else {
      setModulosSeleccionados(obtenerModulosPorRol(rolKey));
    }
  }

  function copiarAccesosDeUsuario(origenIdStr: string) {
    const origenId = Number(origenIdStr);
    if (!origenId) return;

    const origen = usuarios.find((u) => u.id === origenId);
    if (!origen) return;

    const modulosACopiar = origen.modulos && origen.modulos.length > 0
      ? origen.modulos
      : obtenerModulosPorRol(origen.rol);

    setModulosSeleccionados([...modulosACopiar]);
    mostrarNotificacion(
      "exito",
      `Se copiaron ${modulosACopiar.length} módulos desde el usuario "${origen.usuario}"`
    );
  }

  // Abrir Modal Crear
  function abrirModalCrear() {
    setFormUsuario({
      usuario: "",
      password: "",
      confirmarPassword: "",
      rol: "DOCENTE",
      estado: true,
    });
    setModulosSeleccionados(obtenerModulosPorRol("DOCENTE"));
    setBusquedaModulo("");
    setPestanaAccesos("casillas");
    setUsuarioOrigenCopia("");
    setModalCrearAbierto(true);
  }

  // Abrir Modal Editar General
  function abrirModalEditar(u: Usuario) {
    setUsuarioEditando(u);
    setFormUsuario({
      usuario: u.usuario,
      password: "",
      confirmarPassword: "",
      rol: u.rol,
      estado: u.estado,
    });
  }

  // Abrir Modal Administrar Accesos
  function abrirModalAccesos(u: Usuario) {
    setUsuarioAccesos(u);
    const modulosActuales = u.modulos && u.modulos.length > 0 ? u.modulos : obtenerModulosPorRol(u.rol);
    setModulosSeleccionados([...modulosActuales]);
    setBusquedaModulo("");
    setPestanaAccesos("casillas");
    setUsuarioOrigenCopia("");
  }

  // Guardar Nuevo Usuario
  async function submitCrearUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!formUsuario.usuario.trim()) {
      return mostrarNotificacion("error", "Ingrese un nombre de usuario o correo válido");
    }
    if (!formUsuario.password || formUsuario.password.length < 6) {
      return mostrarNotificacion("error", "La contraseña debe tener al menos 6 caracteres");
    }
    if (formUsuario.password !== formUsuario.confirmarPassword) {
      return mostrarNotificacion("error", "Las contraseñas no coinciden");
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": rolActualSesion,
        },
        body: JSON.stringify({
          usuario: formUsuario.usuario.trim(),
          password: formUsuario.password,
          rol: formUsuario.rol,
          estado: formUsuario.estado,
          modulos: modulosSeleccionados,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarNotificacion("error", data.message || "Error al crear usuario");
        return;
      }

      mostrarNotificacion("exito", `Usuario "${data.usuario}" creado con ${data.totalModulos} módulos`);
      setModalCrearAbierto(false);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de red al guardar usuario");
    } finally {
      setGuardando(false);
    }
  }

  // Guardar Edición General de Usuario
  async function submitEditarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioEditando) return;

    if (!formUsuario.usuario.trim()) {
      return mostrarNotificacion("error", "El nombre de usuario es obligatorio");
    }
    if (formUsuario.password && formUsuario.password.length < 6) {
      return mostrarNotificacion("error", "La nueva contraseña debe tener al menos 6 caracteres");
    }
    if (formUsuario.password && formUsuario.password !== formUsuario.confirmarPassword) {
      return mostrarNotificacion("error", "Las contraseñas no coinciden");
    }

    setGuardando(true);
    try {
      const payload: any = {
        id: usuarioEditando.id,
        usuario: formUsuario.usuario.trim(),
        rol: formUsuario.rol,
        estado: formUsuario.estado,
      };
      if (formUsuario.password) {
        payload.password = formUsuario.password;
      }

      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": rolActualSesion,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarNotificacion("error", data.message || "Error al actualizar usuario");
        return;
      }

      mostrarNotificacion("exito", `Usuario "${data.usuario}" actualizado correctamente`);
      setUsuarioEditando(null);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de red al actualizar usuario");
    } finally {
      setGuardando(false);
    }
  }

  // Guardar Cambios de Accesos
  async function submitGuardarAccesos() {
    if (!usuarioAccesos) return;

    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": rolActualSesion,
        },
        body: JSON.stringify({
          id: usuarioAccesos.id,
          usuario: usuarioAccesos.usuario,
          rol: usuarioAccesos.rol,
          estado: usuarioAccesos.estado,
          modulos: modulosSeleccionados,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarNotificacion("error", data.message || "Error al guardar accesos");
        return;
      }

      mostrarNotificacion(
        "exito",
        `Accesos actualizados: ${data.totalModulos} de 23 módulos autorizados para "${data.usuario}"`
      );
      setUsuarioAccesos(null);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error al guardar cambios de accesos");
    } finally {
      setGuardando(false);
    }
  }

  // Alternar Estado Activo / Inactivo directamente
  async function toggleEstadoUsuario(u: Usuario) {
    if (u.usuario === usuarioActualSesion) {
      mostrarNotificacion("error", "No puedes desactivar tu propia cuenta activa");
      return;
    }

    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": rolActualSesion,
        },
        body: JSON.stringify({
          id: u.id,
          usuario: u.usuario,
          rol: u.rol,
          estado: !u.estado,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarNotificacion("error", data.message || "No se pudo cambiar el estado");
        return;
      }

      mostrarNotificacion(
        "exito",
        `Usuario "${u.usuario}" ahora está ${!u.estado ? "ACTIVO" : "INACTIVO"}`
      );
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error al cambiar estado del usuario");
    }
  }

  // Eliminar Usuario
  async function eliminarUsuario(u: Usuario) {
    if (u.usuario === usuarioActualSesion) {
      mostrarNotificacion("error", "No puedes eliminar tu propia cuenta en uso");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar permanentemente al usuario "${u.usuario}"?\n\nSus permisos de módulos se revocarán automáticamente.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/usuarios?id=${u.id}`, {
        method: "DELETE",
        headers: { "x-user-role": rolActualSesion },
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarNotificacion("error", data.message || "Error al eliminar usuario");
        return;
      }
      mostrarNotificacion("exito", `Usuario "${u.usuario}" eliminado correctamente`);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de red al eliminar usuario");
    }
  }

  // Color e insignia del rol
  function getBadgeRol(rol: string) {
    const r = (rol || "").toUpperCase();
    if (r === "ADMIN" || r === "SUPER_ADMIN") {
      return {
        texto: "Administrador",
        icono: "👑",
        clase: "bg-purple-100 text-purple-800 border-purple-200",
      };
    }
    if (r === "DIRECTIVO" || r === "DIRECTOR") {
      return {
        texto: "Directivo",
        icono: "👔",
        clase: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    }
    if (r === "DOCENTE") {
      return {
        texto: "Docente / Auxiliar",
        icono: "📚",
        clase: "bg-sky-100 text-sky-800 border-sky-200",
      };
    }
    if (r === "SECRETARIA") {
      return {
        texto: "Secretaría",
        icono: "📋",
        clase: "bg-teal-100 text-teal-800 border-teal-200",
      };
    }
    if (r === "PORTERIA") {
      return {
        texto: "Portería",
        icono: "🚪",
        clase: "bg-indigo-100 text-indigo-800 border-indigo-200",
      };
    }
    if (r === "DEMO") {
      return {
        texto: "Demo",
        icono: "🧪",
        clase: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    return {
      texto: rol || "Personal",
      icono: "👤",
      clase: "bg-slate-100 text-slate-800 border-slate-200",
    };
  }

  // Filtrado de módulos dentro del modal según el buscador interno
  const modulosVisiblesPorCategoria = useMemo(() => {
    const q = busquedaModulo.toLowerCase().trim();
    const resultado: Record<string, ModuloDefinicion[]> = {};

    for (const cat of CATEGORIAS_MODULOS) {
      const lista = MODULOS_POR_CATEGORIA[cat] || [];
      if (!q) {
        resultado[cat] = lista;
      } else {
        const filtrados = lista.filter(
          (m) =>
            m.nombre.toLowerCase().includes(q) ||
            m.descripcion.toLowerCase().includes(q) ||
            m.ruta.toLowerCase().includes(q)
        );
        if (filtrados.length > 0) {
          resultado[cat] = filtrados;
        }
      }
    }
    return resultado;
  }, [busquedaModulo]);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      {/* Toast Notificación */}
      {notificacion && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border animate-fade-in ${
            notificacion.tipo === "exito"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20"
              : notificacion.tipo === "error"
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-950/20"
              : "bg-blue-600 text-white border-blue-500 shadow-blue-950/20"
          }`}
        >
          <span className="text-xl">
            {notificacion.tipo === "exito" ? "✓" : notificacion.tipo === "error" ? "⚠️" : "ℹ️"}
          </span>
          <span className="font-semibold text-sm">{notificacion.mensaje}</span>
          <button
            onClick={() => setNotificacion(null)}
            className="ml-2 rounded-lg bg-black/20 px-2 py-0.5 text-xs font-bold hover:bg-black/30"
          >
            ✕
          </button>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-2xl text-white shadow-lg shadow-blue-600/30">
              👥
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Gestión de Usuarios
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Administración de cuentas con control dinámico a los 23 módulos operativos
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={abrirModalCrear}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-[0.98]"
        >
          <span className="text-xl leading-none">＋</span>
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* MÉTRICAS RÁPIDAS */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cuentas</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{metricas.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Usuarios Activos</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{metricas.activos}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Inactivos</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{metricas.inactivos}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Acceso Completo (23)</p>
          <p className="mt-1 text-2xl font-black text-indigo-700">{metricas.conAccesoTotal}</p>
        </div>
      </div>

      {/* PANEL PRINCIPAL: TABLA Y FILTROS */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
        {/* Barra de Filtros */}
        <div className="border-b border-slate-100 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por usuario, correo o rol..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              aria-label="Filtrar por rol"
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Todos los roles</option>
              <option value="ADMIN">Administrador</option>
              <option value="DIRECTIVO">Directivo</option>
              <option value="DOCENTE">Docente</option>
              <option value="SECRETARIA">Secretaría</option>
              <option value="PORTERIA">Portería</option>
              <option value="DEMO">Demo</option>
              <option value="PERSONAL">Personal</option>
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label="Filtrar por estado"
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Solo Activos</option>
              <option value="INACTIVO">Solo Inactivos</option>
            </select>

            <button
              onClick={cargarUsuarios}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              title="Recargar usuarios"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Tabla Responsive */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol del Sistema</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Módulos Autorizados</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-xl">⏳</span>
                      <span className="font-semibold">Cargando usuarios...</span>
                    </div>
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <p className="text-base font-bold text-slate-600">No se encontraron usuarios</p>
                    <p className="text-xs text-slate-400 mt-1">Pruebe ajustando los filtros de búsqueda</p>
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const badge = getBadgeRol(u.rol);
                  const totalAutorizados = u.modulos?.length ?? 0;
                  const porcentaje = Math.round((totalAutorizados / MODULOS_OPERATIVOS.length) * 100);

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Usuario */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-sm">
                            {u.usuario.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{u.usuario}</p>
                            <p className="text-xs text-slate-400">
                              ID: #{u.id} {u.colegioId ? `• ${u.colegioId}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${badge.clase}`}
                        >
                          <span>{badge.icono}</span>
                          <span>{badge.texto}</span>
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleEstadoUsuario(u)}
                          title="Hacer clic para alternar estado"
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                            u.estado
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.estado ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            }`}
                          />
                          <span>{u.estado ? "Activo" : "Inactivo"}</span>
                        </button>
                      </td>

                      {/* Módulos Autorizados */}
                      <td className="px-6 py-4">
                        <div className="w-48">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                            <span className="flex items-center gap-1">
                              <span className="text-blue-600 font-extrabold">{totalAutorizados}</span>
                              <span className="text-slate-400">/ 23 módulos</span>
                            </span>
                            <span className="text-[11px] text-slate-400">{porcentaje}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                totalAutorizados === 23
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : totalAutorizados > 10
                                  ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                                  : "bg-gradient-to-r from-amber-500 to-orange-500"
                              }`}
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Botón Administrar Accesos */}
                          <button
                            onClick={() => abrirModalAccesos(u)}
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 active:scale-95"
                            title="Administrar accesos a los 23 módulos"
                          >
                            <span>🔐</span>
                            <span className="hidden sm:inline">Accesos</span>
                          </button>

                          {/* Botón Editar General */}
                          <button
                            onClick={() => abrirModalEditar(u)}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
                            title="Editar usuario y contraseña"
                          >
                            <span>✏️</span>
                            <span className="hidden sm:inline">Editar</span>
                          </button>

                          {/* Botón Eliminar */}
                          <button
                            onClick={() => eliminarUsuario(u)}
                            disabled={u.usuario === usuarioActualSesion}
                            className="inline-flex items-center justify-center rounded-xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 disabled:opacity-30 disabled:hover:bg-rose-50 active:scale-95"
                            title="Eliminar usuario"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: ADMINISTRAR ACCESOS A LOS 23 MÓDULOS                        */}
      {/* ==================================================================== */}
      {usuarioAccesos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-md">
                  🔐
                </span>
                <div>
                  <h2 className="text-lg font-black leading-tight">
                    Administrar Accesos: <span className="text-blue-400">{usuarioAccesos.usuario}</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Rol: {usuarioAccesos.rol} • Seleccione con un clic SÍ / NO para cada uno de los 23 módulos
                  </p>
                </div>
              </div>

              <button
                onClick={() => setUsuarioAccesos(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Barra de Controles Rápidos */}
            <div className="border-b border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Contador de Módulos */}
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 rounded-xl bg-blue-100/80 px-3 py-1.5 text-xs font-black text-blue-800">
                    <span>✓</span>
                    <span>
                      {modulosSeleccionados.length} de {MODULOS_OPERATIVOS.length} Seleccionados
                    </span>
                  </span>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={seleccionarTodos}
                      className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      onClick={quitarTodos}
                      className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Quitar todos
                    </button>
                  </div>
                </div>

                {/* Copiar accesos y Pestañas */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Desplegable Copiar Accesos */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-500">Copiar de:</span>
                    <select
                      value={usuarioOrigenCopia}
                      aria-label="Copiar accesos de otro usuario"
                      onChange={(e) => {
                        setUsuarioOrigenCopia(e.target.value);
                        copiarAccesosDeUsuario(e.target.value);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"
                    >
                      <option value="">Seleccionar usuario...</option>
                      {usuarios
                        .filter((u) => u.id !== usuarioAccesos.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.usuario} ({u.modulos?.length ?? 0} mód.)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Toggle Pestañas Casillas / Preview */}
                  <div className="flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPestanaAccesos("casillas")}
                      className={`rounded-lg px-3 py-1 transition ${
                        pestanaAccesos === "casillas"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Casillas
                    </button>
                    <button
                      type="button"
                      onClick={() => setPestanaAccesos("preview")}
                      className={`rounded-lg px-3 py-1 transition ${
                        pestanaAccesos === "preview"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Vista Previa Menú
                    </button>
                  </div>
                </div>
              </div>

              {/* Buscador interno de módulos */}
              {pestanaAccesos === "casillas" && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={busquedaModulo}
                    onChange={(e) => setBusquedaModulo(e.target.value)}
                    placeholder="Filtrar módulos por nombre o descripción..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Contenido Modal: Casillas o Preview */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {pestanaAccesos === "casillas" ? (
                <div className="space-y-6">
                  {Object.entries(modulosVisiblesPorCategoria).map(([categoria, listaModulos]) => {
                    if (listaModulos.length === 0) return null;

                    const marcadosCategoria = listaModulos.filter((m) =>
                      modulosSeleccionados.includes(m.id)
                    ).length;

                    return (
                      <div key={categoria} className="rounded-2xl border border-slate-200 bg-white p-4">
                        {/* Cabecera Categoría */}
                        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                              {categoria}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {marcadosCategoria} de {listaModulos.length}
                            </span>
                          </div>

                          <div className="flex gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const ids = listaModulos.map((m) => m.id);
                                setModulosSeleccionados((prev) => Array.from(new Set([...prev, ...ids])));
                              }}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              Marcar grupo
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = listaModulos.map((m) => m.id);
                                setModulosSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
                              }}
                              className="text-slate-500 font-bold hover:underline"
                            >
                              Desmarcar
                            </button>
                          </div>
                        </div>

                        {/* Cuadrícula de Casillas */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {listaModulos.map((m) => {
                            const seleccionado = modulosSeleccionados.includes(m.id);

                            return (
                              <label
                                key={m.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                  seleccionado
                                    ? "border-blue-500 bg-blue-50/40 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={seleccionado}
                                  onChange={() => toggleModulo(m.id)}
                                  className="mt-1 h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{m.icono}</span>
                                    <span className="font-bold text-sm text-slate-900">{m.nombre}</span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">
                                    {m.descripcion}
                                  </p>
                                  <p className="mt-1 text-[10px] font-mono text-slate-400 truncate">
                                    {m.ruta}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Vista Previa del Menú Lateral */
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white max-w-sm mx-auto shadow-2xl">
                  <div className="text-center pb-4 border-b border-slate-800">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Vista Previa del Menú Lateral
                    </p>
                    <p className="text-sm font-bold text-white mt-1">Usuario: {usuarioAccesos.usuario}</p>
                    <p className="text-xs text-blue-400">({modulosSeleccionados.length} módulos visibles)</p>
                  </div>

                  <div className="mt-4 space-y-4 max-h-[450px] overflow-y-auto pr-2">
                    {CATEGORIAS_MODULOS.map((cat) => {
                      const modulosVisibles = (MODULOS_POR_CATEGORIA[cat] || []).filter((m) =>
                        modulosSeleccionados.includes(m.id)
                      );
                      if (modulosVisibles.length === 0) return null;

                      return (
                        <div key={cat}>
                          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {cat}
                          </p>
                          <div className="space-y-1">
                            {modulosVisibles.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-2.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200"
                              >
                                <span>{m.icono}</span>
                                <span>{m.nombre}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {modulosSeleccionados.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No hay módulos seleccionados. El usuario no verá ninguna opción en el menú lateral.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal: Botón Guardar */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4">
              <div className="text-xs text-slate-500">
                Se actualizarán inmediatamente los permisos de sesión.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUsuarioAccesos(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitGuardarAccesos}
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar toda la selección"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREAR NUEVO USUARIO                                         */}
      {/* ==================================================================== */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold">
                  👤
                </span>
                <div>
                  <h2 className="text-lg font-black leading-tight">Crear Nuevo Usuario</h2>
                  <p className="text-xs text-slate-400">
                    Configure las credenciales básicas y seleccione directamente los módulos autorizados
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalCrearAbierto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitCrearUsuario} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Datos Básicos */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4">
                    1. Datos de Identificación y Acceso
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nombre de Usuario o Correo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formUsuario.usuario}
                        onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })}
                        placeholder="Ej. docente.garcia o porteria_puerta1"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Rol Descriptivo / Plantilla
                      </label>
                      <select
                        value={formUsuario.rol}
                        onChange={(e) => {
                          const nuevoRol = e.target.value;
                          setFormUsuario({ ...formUsuario, rol: nuevoRol });
                          aplicarPlantillaRol(nuevoRol);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="ADMIN">Administrador (Todos los módulos)</option>
                        <option value="DIRECTIVO">Directivo / Director</option>
                        <option value="DOCENTE">Docente / Auxiliar</option>
                        <option value="SECRETARIA">Secretaría Académica</option>
                        <option value="PORTERIA">Portería / Control de Puerta</option>
                        <option value="DEMO">Modo Demostración</option>
                        <option value="PERSONALIZADO">Personalizado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contraseña Inicial *
                      </label>
                      <input
                        type="password"
                        required
                        value={formUsuario.password}
                        onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirmar Contraseña *
                      </label>
                      <input
                        type="password"
                        required
                        value={formUsuario.confirmarPassword}
                        onChange={(e) =>
                          setFormUsuario({ ...formUsuario, confirmarPassword: e.target.value })
                        }
                        placeholder="Repita la contraseña"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formUsuario.estado}
                          onChange={(e) => setFormUsuario({ ...formUsuario, estado: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">
                          Usuario Activo (Permite iniciar sesión inmediatamente)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selección de Módulos */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        2. Selección de los 23 Módulos Operativos
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {modulosSeleccionados.length} de {MODULOS_OPERATIVOS.length} seleccionados
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={seleccionarTodos}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={quitarTodos}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Quitar todos
                      </button>

                      <select
                        value={usuarioOrigenCopia}
                        aria-label="Copiar de usuario existente"
                        onChange={(e) => {
                          setUsuarioOrigenCopia(e.target.value);
                          copiarAccesosDeUsuario(e.target.value);
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700"
                      >
                        <option value="">Copiar de usuario existente...</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.usuario} ({u.modulos?.length ?? 0} mód.)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Lista de Casillas */}
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                    {CATEGORIAS_MODULOS.map((categoria) => {
                      const lista = MODULOS_POR_CATEGORIA[categoria] || [];
                      return (
                        <div key={categoria} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                            {categoria}
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {lista.map((m) => {
                              const checked = modulosSeleccionados.includes(m.id);
                              return (
                                <label
                                  key={m.id}
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition ${
                                    checked
                                      ? "border-blue-400 bg-blue-50/60"
                                      : "border-slate-200 bg-white hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleModulo(m.id)}
                                    className="h-4 w-4 rounded text-blue-600"
                                  />
                                  <span className="text-sm">{m.icono}</span>
                                  <span className="text-xs font-bold text-slate-800 truncate">
                                    {m.nombre}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Modal Crear */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {guardando ? "Creando usuario..." : "Guardar y Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: EDITAR USUARIO GENERAL                                      */}
      {/* ==================================================================== */}
      {usuarioEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-xl font-bold">
                  ✏️
                </span>
                <div>
                  <h2 className="text-lg font-black leading-tight">
                    Editar: <span className="text-blue-400">{usuarioEditando.usuario}</span>
                  </h2>
                  <p className="text-xs text-slate-400">Modifique credenciales y rol general</p>
                </div>
              </div>

              <button
                onClick={() => setUsuarioEditando(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitEditarUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de Usuario / Correo
                </label>
                <input
                  type="text"
                  required
                  value={formUsuario.usuario}
                  onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rol del Sistema
                </label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="DIRECTIVO">Directivo</option>
                  <option value="DOCENTE">Docente</option>
                  <option value="SECRETARIA">Secretaría</option>
                  <option value="PORTERIA">Portería</option>
                  <option value="DEMO">Demo</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Contraseña (Opcional, dejar en blanco para conservar)
                </label>
                <input
                  type="password"
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {formUsuario.password && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={formUsuario.confirmarPassword}
                    onChange={(e) =>
                      setFormUsuario({ ...formUsuario, confirmarPassword: e.target.value })
                    }
                    placeholder="Repita la nueva contraseña"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formUsuario.estado}
                    onChange={(e) => setFormUsuario({ ...formUsuario, estado: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-700">Estado de cuenta Activo</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUsuarioEditando(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? "Actualizando..." : "Actualizar Datos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
