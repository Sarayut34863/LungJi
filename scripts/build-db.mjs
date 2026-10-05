import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ROOT_DIR = process.cwd();
const JSON_PATH = path.join(ROOT_DIR, "src", "data", "ck-pricelist.json");
const RARITY_PATH = path.join(ROOT_DIR, "src", "data", "rarity-map.json");
const DB_PATH = path.join(ROOT_DIR, "src", "data", "cards.db");

const CHAR_TO_RARITY = {
  m: "mythic",
  r: "rare",
  u: "uncommon",
  c: "common",
  s: "special",
};

export function buildDatabase() {
  console.log("Reading data files...");
  const startTime = Date.now();

  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`ck-pricelist.json not found at ${JSON_PATH}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  const cards = rawJson.data || [];
  const meta = {
    created_at: rawJson.meta?.created_at || new Date().toISOString(),
    base_url: rawJson.meta?.base_url || "https://www.cardkingdom.com/",
  };

  let rarityMap = {};
  if (fs.existsSync(RARITY_PATH)) {
    try {
      rarityMap = JSON.parse(fs.readFileSync(RARITY_PATH, "utf-8"));
    } catch {}
  }

  // Remove existing DB file if it exists to start fresh
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.unlinkSync(DB_PATH);
    } catch {}
  }

  console.log(`Creating SQLite database at ${DB_PATH}...`);
  const db = new DatabaseSync(DB_PATH);

  // Optimize SQLite settings for performance
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA temp_store = MEMORY;");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      sku TEXT,
      scryfall_id TEXT,
      name TEXT NOT NULL,
      clean_name TEXT NOT NULL,
      edition TEXT NOT NULL,
      variation TEXT,
      is_foil INTEGER NOT NULL DEFAULT 0,
      rarity TEXT,
      price_retail REAL NOT NULL DEFAULT 0,
      qty_retail INTEGER NOT NULL DEFAULT 0,
      price_buy REAL NOT NULL DEFAULT 0,
      qty_buying INTEGER NOT NULL DEFAULT 0,
      url TEXT,
      condition_values TEXT
    );
  `);

  // Save metadata
  const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("created_at", meta.created_at);
  insertMeta.run("base_url", meta.base_url);
  insertMeta.run("total_cards", String(cards.length));

  // Prepare batch insert
  const insertCard = db.prepare(`
    INSERT INTO cards (
      id, sku, scryfall_id, name, clean_name, edition, variation,
      is_foil, rarity, price_retail, qty_retail, price_buy, qty_buying, url, condition_values
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  console.log(`Inserting ${cards.length.toLocaleString()} cards in a single transaction...`);
  db.exec("BEGIN TRANSACTION;");

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const isFoil = (c.is_foil === "true" || c.is_foil === true || c.is_foil === 1) ? 1 : 0;
    
    // Rarity determination
    let rarity = c.rarity || null;
    if (!rarity && c.scryfall_id && rarityMap[c.scryfall_id]) {
      rarity = CHAR_TO_RARITY[rarityMap[c.scryfall_id]] || "common";
    }

    // Clean name for fast search
    const cleanName = (c.name || "").includes("//")
      ? c.name.split("//")[0].trim()
      : (c.name || "").trim();

    const priceRetail = parseFloat(c.condition_values?.nm_price || c.price_retail) || 0;
    const priceBuy = parseFloat(c.price_buy) || 0;
    const condJson = c.condition_values ? JSON.stringify(c.condition_values) : null;

    insertCard.run(
      c.id,
      c.sku || null,
      c.scryfall_id || null,
      c.name || "",
      cleanName,
      c.edition || "Unknown",
      c.variation || null,
      isFoil,
      rarity,
      priceRetail,
      Number(c.qty_retail) || 0,
      priceBuy,
      Number(c.qty_buying) || 0,
      c.url || null,
      condJson
    );
  }

  db.exec("COMMIT;");

  console.log("Building B-Tree indexes...");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cards_price ON cards (price_retail DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_edition ON cards (edition);
    CREATE INDEX IF NOT EXISTS idx_cards_edition_price ON cards (edition, price_retail DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards (rarity);
    CREATE INDEX IF NOT EXISTS idx_cards_foil ON cards (is_foil);
    CREATE INDEX IF NOT EXISTS idx_cards_clean_name ON cards (clean_name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_cards_sku ON cards (sku);
  `);

  console.log("Building FTS5 full-text search index...");
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      clean_name,
      sku,
      tokenize='trigram',
      content='cards',
      content_rowid='id'
    );
    INSERT INTO cards_fts(cards_fts) VALUES('rebuild');
  `);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const stats = fs.statSync(DB_PATH);
  const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`Database generated successfully in ${elapsed}s! Size: ${sizeMb} MB`);

  db.close();
}

// Run if called directly
buildDatabase();
