import { NextResponse } from "next/server";
import { getEditions } from "@/lib/cardkingdom";

export async function GET() {
  try {
    const data = await getEditions();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error in /api/editions:", error);
    return NextResponse.json(
      { error: "Failed to fetch editions", details: String(error) },
      { status: 500 }
    );
  }
}
