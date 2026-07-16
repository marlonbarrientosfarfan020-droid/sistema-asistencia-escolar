import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-telegram-bot-api-secret-token");

    if (
      process.env.TELEGRAM_WEBHOOK_SECRET &&
      token !== process.env.TELEGRAM_WEBHOOK_SECRET
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Webhook no autorizado",
        },
        {
          status: 401,
        }
      );
    }

    const update = await request.json();

    console.log("Webhook Telegram:", update);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Error webhook Telegram:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno",
      },
      {
        status: 500,
      }
    );
  }
}