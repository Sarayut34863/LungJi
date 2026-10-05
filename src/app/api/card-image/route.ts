import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/cardkingdom";

const CACHE_DIR = path.join(process.cwd(), ".next", "cache", "card-images");

// In-memory cache for name -> scryfallId lookups to avoid repeated DB queries
const nameToIdCache = new Map<string, string>();

function lookupScryfallIdByName(rawName: string): string | null {
  const clean = rawName.includes("//") ? rawName.split("//")[0].trim() : rawName.trim();
  const lower = clean.toLowerCase();

  if (nameToIdCache.has(lower)) {
    return nameToIdCache.get(lower) || null;
  }

  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT scryfall_id FROM cards WHERE clean_name = ? AND scryfall_id IS NOT NULL AND length(scryfall_id) >= 2 LIMIT 1"
    ).get(clean) as { scryfall_id?: string } | undefined;

    if (row?.scryfall_id) {
      if (nameToIdCache.size < 5000) nameToIdCache.set(lower, row.scryfall_id);
      return row.scryfall_id;
    }

    // Secondary case-insensitive match
    const rowLike = db.prepare(
      "SELECT scryfall_id FROM cards WHERE clean_name LIKE ? AND scryfall_id IS NOT NULL AND length(scryfall_id) >= 2 LIMIT 1"
    ).get(clean) as { scryfall_id?: string } | undefined;

    const id = rowLike?.scryfall_id || null;
    if (id && nameToIdCache.size < 5000) {
      nameToIdCache.set(lower, id);
    }
    return id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scryfallId = searchParams.get("id");
  const name = searchParams.get("name");
  const size = searchParams.get("size") || "normal";

  const validSize = ["small", "normal", "large"].includes(size) ? size : "normal";

  if (!scryfallId && !name) {
    return new NextResponse("Missing card id or name", { status: 400 });
  }

  let effectiveId = scryfallId;
  if ((!effectiveId || effectiveId.length < 2) && name) {
    effectiveId = lookupScryfallIdByName(name);
  }

  // 1. Direct Scryfall ID fast path
  if (effectiveId && effectiveId.length >= 2) {
    const cleanId = effectiveId.toLowerCase().trim();
    const sizeDir = path.join(CACHE_DIR, validSize);
    const filePath = path.join(sizeDir, `${cleanId}.jpg`);

    // Check local disk cache first (Ultra fast ~1ms)
    try {
      if (fs.existsSync(filePath)) {
        const fileBuffer = await fs.promises.readFile(filePath);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Card-Cache": "HIT",
          },
        });
      }
    } catch {
      // Proceed to remote redirect
    }

    // Offload image traffic directly to Scryfall Cloudflare CDN (Saves 100% server bandwidth)
    const remoteUrl = `https://cards.scryfall.io/${validSize}/front/${cleanId[0]}/${cleanId[1]}/${cleanId}.jpg`;
    return NextResponse.redirect(remoteUrl, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  // 2. Fallback: Fuzzy Name Search redirect via Scryfall API
  const rawName = name || "";
  const targetName = rawName.includes("//") ? rawName.split("//")[0].trim() : rawName;
  const fallbackUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(
    targetName
  )}&format=image&version=${validSize}`;

  return NextResponse.redirect(fallbackUrl, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
