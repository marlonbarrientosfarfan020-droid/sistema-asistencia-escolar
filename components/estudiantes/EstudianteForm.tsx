"use client";

import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";

export default function EstudianteForm({
  onGuardado,
}: {
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    codigo: "",
    dni: "",
    nombres: "",
    apellidos: "",
    grado: "",
    seccion: "",
    nombreTutor: "",
    whatsapp: "",
  });

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    if (name === "dni") {
      setForm({ ...form, dni: value.replace(/\D/g, "").slice(0, 8) });
      return;
    }

    if (name === "whatsapp") {
      setForm({ ...form, whatsapp: value.replace(/\D/g, "").slice(0, 12) });
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
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
      !form.whatsapp.trim()
    ) {
      setMensaje("⚠️ Complete todos los campos");
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
      }),
    });

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
      });

      onGuardado();
    } else {
      setMensaje("❌ Error al registrar estudiante. Verifica que el código o DNI no estén repetidos.");
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

        <Button
          type="submit"
          className="col-span-2 bg-slate-900 text-white disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar estudiante"}
        </Button>
      </form>
    </Card>
  );
}