import { NextResponse } from "next/server";
import { fetchDevpostParticipantCount } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const participants = await fetchDevpostParticipantCount();
    return NextResponse.json(
      { participants },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch Devpost:", error);
    return NextResponse.json(
      { error: "Failed to fetch Devpost data", participants: null },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
