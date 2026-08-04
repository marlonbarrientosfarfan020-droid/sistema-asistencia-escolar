import { NextResponse } from "next/server";

import {
  ListCollectionsCommand,
} from "@aws-sdk/client-rekognition";

import {
  rekognition,
} from "@/lib/aws-rekognition";

export async function GET() {
  try {
    const resultado =
      await rekognition.send(
        new ListCollectionsCommand({})
      );

    return NextResponse.json({
      ok: true,
      collections:
        resultado.CollectionIds || [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error,
      },
      {
        status: 500,
      }
    );
  }
}