export function esCronAutorizado(request: Request) {
  const secreto = process.env.CRON_SECRET;

  if (!secreto || secreto.length < 32) {
    console.error("CRON_SECRET no está configurado correctamente");
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${secreto}`;
}

export function respuestaCronNoAutorizado() {
  return Response.json(
    {
      ok: false,
      message: "Cron no autorizado",
    },
    {
      status: 401,
    }
  );
}