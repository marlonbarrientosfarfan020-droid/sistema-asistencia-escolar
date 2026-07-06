"use client";

import { useEffect, useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
};

export default function EstudianteForm({
  onGuardado,
}: {
  onGuardado: () => void;
}) {
  const [turnos, setTurnos] = useState<Turno[]>([]);

  const [form, setForm] = useState({
    codigo: "",
    dni: "",
    nombres: "",
    apellidos: "",
    grado: "",
    seccion: "",
    nombreTutor: "",
    whatsapp: "",
    telegramChatId: "",
    turnoId: "",
  });

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargarTurnos() {
      const res = await fetch("/api/turnos", {
        headers: {
          "x-user-role": localStorage.getItem("rol") || "",
          "x-user-name": localStorage.getItem("usuario") || "",
        },
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setTurnos(data);
      } else {
        setTurnos([]);
      }
    }

    cargarTurnos();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    if (name === "dni") {
      setForm({ ...form, dni: value.replace(/\D/g, "").slice(0, 8) });
      return;
    }

    if (name === "whatsapp") {
      setForm({ ...form, whatsapp: value.replace(/\D/g, "").slice(0, 12) });
      return;
    }

    if (name === "telegramChatId") {
      setForm({
        ...form,
        telegramChatId: value.replace(/\D/g, "").slice(0, 20),
      });
      return;
    }

    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (
      !form.codigo.trim() ||
      !form.dni.trim() ||
      !form.nombres.trim() ||
      !form.apellidos.trim() ||
      !form.grado.trim() ||
      !form.seccion.trim() ||
      !form.nombreTutor.trim() ||
      !form.whatsapp.trim() ||
      !form.turnoId
    ) {
      setMensaje("⚠️ Complete todos los campos obligatorios");
      return;
    }

    if (form.dni.length !== 8) {
      setMensaje("⚠️ El DNI debe tener 8 dígitos");
      return;
    }

    if (form.whatsapp.length < 9) {
      setMensaje("⚠️ El WhatsApp debe tener al menos 9 dígitos");
      return;
    }

    setGuardando(true);
    setMensaje("");

    const res = await fetch("/api/estudiantes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
      body: JSON.stringify({
        ...form,
        codigo: form.codigo.trim(),
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        grado: form.grado.trim(),
        seccion: form.seccion.trim(),
        nombreTutor: form.nombreTutor.trim(),
        whatsapp: form.whatsapp.trim(),
        telegramChatId: form.telegramChatId.trim(),
        turnoId: Number(form.turnoId),
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Estudiante registrado correctamente");

      setForm({
        codigo: "",
        dni: "",
        nombres: "",
        apellidos: "",
        grado: "",
        seccion: "",
        nombreTutor: "",
        whatsapp: "",
        telegramChatId: "",
        turnoId: "",
      });

      onGuardado();
    } else {
      setMensaje(`❌ ${data.message || "Error al registrar estudiante"}`);
    }

    setGuardando(false);
  }

  return (
    <Card>
      <h3 className="text-xl font-bold mb-5">Registrar estudiante</h3>

      {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-5">
        <Input name="codigo" value={form.codigo} onChange={handleChange} placeholder="Código" />
        <Input name="dni" value={form.dni} onChange={handleChange} placeholder="DNI" />
        <Input name="nombres" value={form.nombres} onChange={handleChange} placeholder="Nombres" />
        <Input name="apellidos" value={form.apellidos} onChange={handleChange} placeholder="Apellidos" />
        <Input name="grado" value={form.grado} onChange={handleChange} placeholder="Grado" />
        <Input name="seccion" value={form.seccion} onChange={handleChange} placeholder="Sección" />
        <Input name="nombreTutor" value={form.nombreTutor} onChange={handleChange} placeholder="Nombre del tutor" />
        <Input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="WhatsApp del tutor" />

        <Input
          name="telegramChatId"
          value={form.telegramChatId}
          onChange={handleChange}
          placeholder="Telegram Chat ID del tutor"
        />

        <select
          name="turnoId"
          value={form.turnoId}
          onChange={handleChange}
          className="border rounded-xl p-3 w-full"
        >
          <option value="">Seleccione turno</option>
          {turnos.map((turno) => (
            <option key={turno.id} value={turno.id}>
              {turno.nombre} ({turno.horaEntrada} - {turno.horaSalida})
            </option>
          ))}
        </select>

        <Button
          type="submit"
          className={`col-span-2 bg-slate-900 text-white ${
            guardando ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {guardando ? "Guardando..." : "Guardar estudiante"}
        </Button>
      </form>
    </Card>
  );
}