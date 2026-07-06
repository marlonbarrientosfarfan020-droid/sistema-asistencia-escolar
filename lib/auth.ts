import { NextResponse } from "next/server";

export function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

export function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

export function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

export function noAutorizado() {
  return NextResponse.json(
    { message: "No autorizado" },
    { status: 401 }
  );
}