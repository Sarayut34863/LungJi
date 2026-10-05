import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ROOT_DIR = process.cwd();
const DB_PATH = path.join(ROOT_DIR, "src", "data", "cards.db");
const CACHE_DIR = path.join(ROOT_DIR, ".next", "cache", "card-images");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadImage(cleanId, size = "normal") {
  const sizeDir = path.join(CACHE_DIR, size);
  ensureDir(sizeDir);
  const filePath = path.join(sizeDir, `${cleanId}.jpg`);

  if (fs.existsSync(filePath)) {
    return false; // Already cached
  }

  const url = `https://cards.scryfall.io/${size}/front/${cleanId[0]}/${cleanId[1]}/${cleanId}.jpg`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LungJiMTG-Prewarmer/1.0",
        Accept: "image/jpeg,image/webp,image/*,*/*",
      },
    });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      return true;
    }
  } catch (err) {
    // Silently skip failed prewarms
  }
  return false;
}

export async function warmCache(limit = 100) {
  if (!fs.existsSync(DB_PATH)) {
    console.error("cards.db not found. Run build-db.mjs first.");
    return;
  }

  const db = new DatabaseSync(DB_PATH);
  
  // Query top iconic cards and staples
  const cards = db.prepare(`
    SELECT DISTINCT scryfall_id, name, edition, price_retail
    FROM cards
    WHERE scryfall_id IS NOT NULL AND length(scryfall_id) > 5
    ORDER BY price_retail DESC
    LIMIT ?
  `).all(limit);

  console.log(`Starting cache pre-warm for top ${cards.length} iconic cards...`);
  let downloaded = 0;
  let skipped = 0;

  // Process in small batches of 4 with slight delay to respect Scryfall guidelines
  const batchSize = 4;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (c) => {
        const id = c.scryfall_id.toLowerCase().trim();
        const resNormal = await downloadImage(id, "normal");
        if (resNormal) downloaded++;
        else skipped++;
      })
    );
    // 50ms gentle pause
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(`Pre-warming complete! Downloaded: ${downloaded}, Already cached: ${skipped}`);
  db.close();
}

// Run if called directly
warmCache(120);
