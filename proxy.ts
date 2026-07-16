import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sesion_santa_rita";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tokenSesion =
    request.cookies.get(COOKIE_NAME)?.value;

  const esRutaDashboard =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  if (esRutaDashboard && !tokenSesion) {
    const urlLogin = new URL(
      "/login",
      request.url
    );

    urlLogin.searchParams.set(
      "retorno",
      pathname
    );

    return NextResponse.redirect(urlLogin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};