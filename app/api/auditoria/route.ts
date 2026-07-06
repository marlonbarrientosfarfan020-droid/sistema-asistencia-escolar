import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  const auditoria = await prisma.auditoria.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return NextResponse.json(auditoria);
}