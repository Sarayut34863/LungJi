import { NextRequest, NextResponse } from "next/server";
import { searchCards, fetchCKData, SearchParams } from "@/lib/cardkingdom";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const forceRefresh = searchParams.get("refresh") === "true";
    if (forceRefresh) {
      await fetchCKData(true);
    }

    const edition = searchParams.get("edition") || undefined;
    const search = searchParams.get("search") || undefined;
    const foil = (searchParams.get("foil") as SearchParams["foil"]) || "all";
    const rarity = (searchParams.get("rarity") as SearchParams["rarity"]) || "all";
    const color = searchParams.get("color") || undefined;
    const colorMode = (searchParams.get("colorMode") as SearchParams["colorMode"]) || "exact";
    const tokens = (searchParams.get("tokens") as SearchParams["tokens"]) || "hide";
    const variants = (searchParams.get("variants") as SearchParams["variants"]) || "hide";
    const inStock = searchParams.get("inStock") === "true";
    const minPriceParam = searchParams.get("minPrice");
    const maxPriceParam = searchParams.get("maxPrice");
    const minPrice = minPriceParam ? parseFloat(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : undefined;
    const sortBy = (searchParams.get("sortBy") as SearchParams["sortBy"]) || "price_desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "24", 10);

    const result = await searchCards({
      edition,
      search,
      foil,
      rarity,
      color,
      colorMode,
      tokens,
      variants,
      inStock,
      minPrice,
      maxPrice,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Error in /api/cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards", details: String(error) },
      { status: 500 }
    );
  }
}
