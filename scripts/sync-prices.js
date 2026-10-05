const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'cards.db');
const rarityPath = path.join(__dirname, '..', 'src', 'data', 'rarity-map.json');

async function downloadPricelist() {
  console.log("Connecting to Card Kingdom API...");
  return new Promise((resolve, reject) => {
    https.get('https://api.cardkingdom.com/api/v2/pricelist', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download: status ${res.statusCode}`));
      }

      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      }

      const chunks = [];
      let totalBytes = 0;

      stream.on('data', chunk => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes % (10 * 1024 * 1024) < chunk.length) {
          process.stdout.write(`Downloaded ${(totalBytes / 1024 / 1024).toFixed(1)} MB...\r`);
        }
      });

      stream.on('end', () => {
        console.log(`\nDownload completed: ${(totalBytes / 1024 / 1024).toFixed(1)} MB uncompressed.`);
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });

      stream.on('error', reject);
    }).on('error', reject);
  });
}

function cleanName(n) {
  return (n || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const rarityCodeMap = {
  c: "common",
  u: "uncommon",
  r: "rare",
  m: "mythic",
  s: "special"
};

async function run() {
  const jsonStr = await downloadPricelist();
  console.log("Parsing JSON...");
  const parsed = JSON.parse(jsonStr);

  const meta = parsed.meta || {};
  const data = parsed.data || [];
  console.log(`Loaded ${data.length} cards from Card Kingdom.`);
  console.log("Card Kingdom Meta Created At:", meta.created_at);

  let rarityMap = {};
  if (fs.existsSync(rarityPath)) {
    try {
      rarityMap = JSON.parse(fs.readFileSync(rarityPath, 'utf8'));
    } catch {}
  }

  console.log("Opening SQLite database:", dbPath);
  const db = new DatabaseSync(dbPath);

  console.log("Starting bulk price update and sync...");
  db.exec("BEGIN TRANSACTION;");

  const updateStmt = db.prepare(`
    UPDATE cards 
    SET price_retail = ?,
        price_buy = ?,
        qty_retail = ?,
        qty_buying = ?,
        condition_values = ?
    WHERE id = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO cards (
      id, sku, scryfall_id, name, clean_name, edition, variation,
      is_foil, rarity, price_retail, qty_retail, price_buy, qty_buying, url, condition_values
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFtsStmt = db.prepare(`
    INSERT INTO cards_fts (rowid, clean_name, sku) VALUES (?, ?, ?)
  `);

  let updatedCount = 0;
  let insertedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const card = data[i];
    const retail = parseFloat(card.price_retail) || 0;
    const buy = parseFloat(card.price_buy) || 0;
    const condJson = card.condition_values ? JSON.stringify(card.condition_values) : null;

    const result = updateStmt.run(
      retail,
      buy,
      card.qty_retail || 0,
      card.qty_buying || 0,
      condJson,
      card.id
    );

    if (result.changes > 0) {
      updatedCount++;
    } else {
      // Insert new card
      const cName = cleanName(card.name);
      const isFoil = card.is_foil === "true" || card.is_foil === true || card.is_foil === 1 ? 1 : 0;
      let rarity = undefined;
      if (card.scryfall_id && rarityMap[card.scryfall_id]) {
        rarity = rarityCodeMap[rarityMap[card.scryfall_id]] || rarityMap[card.scryfall_id];
      }

      insertStmt.run(
        card.id,
        card.sku || "",
        card.scryfall_id || "",
        card.name,
        cName,
        card.edition || "Unknown",
        card.variation || "",
        isFoil,
        rarity || null,
        retail,
        card.qty_retail || 0,
        buy,
        card.qty_buying || 0,
        card.url || "",
        condJson
      );

      try {
        insertFtsStmt.run(card.id, cName, card.sku || "");
      } catch {}

      insertedCount++;
    }
  }

  // Update meta table
  const metaStmt = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  metaStmt.run("created_at", meta.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19));
  if (meta.base_url) metaStmt.run("base_url", meta.base_url);
  metaStmt.run("total_cards", String(data.length));

  db.exec("COMMIT;");
  console.log(`\nSync complete! Updated: ${updatedCount} | Inserted new: ${insertedCount} | Total in DB: ${data.length}`);
  console.log("Meta table updated with timestamp:", meta.created_at);
}

run().catch(console.error);
