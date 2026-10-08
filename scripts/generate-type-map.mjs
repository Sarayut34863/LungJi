import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');
const typeMapFile = path.join(dataDir, 'type-map.json');
const dbPath = path.join(dataDir, 'cards.db');

function cleanName(n) {
  return (n || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function run() {
  console.log('Fetching Scryfall bulk metadata...');
  const metaRes = await fetch('https://api.scryfall.com/bulk-data', {
    headers: { 'User-Agent': 'LungJi/1.0', Accept: 'application/json' },
  });
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch Scryfall bulk metadata: ${metaRes.status}`);
  }
  const metaJson = await metaRes.json();
  const bulkObj = metaJson.data.find((x) => x.type === 'oracle_cards');
  if (!bulkObj || !bulkObj.jsonl_download_uri) {
    throw new Error('Oracle cards bulk object not found');
  }

  console.log(`Downloading and parsing stream from ${bulkObj.jsonl_download_uri}...`);
  const streamRes = await fetch(bulkObj.jsonl_download_uri, {
    headers: { 'User-Agent': 'LungJi/1.0' },
  });
  if (!streamRes.ok) {
    throw new Error(`Failed to stream download: ${streamRes.status}`);
  }

  const gunzip = zlib.createGunzip();
  const nodeStream = Readable.fromWeb(streamRes.body);
  const rl = readline.createInterface({
    input: nodeStream.pipe(gunzip),
    crlfDelay: Infinity,
  });

  const typeMap = {};
  let count = 0;
  for await (const line of rl) {
    if (!line) continue;
    try {
      const card = JSON.parse(line);
      if (card.name && card.type_line) {
        const cName = cleanName(card.name);
        typeMap[cName] = card.type_line;

        // If it's a double-faced card (e.g. "Card A // Card B"), also map front name
        if (card.name.includes('//')) {
          const front = cleanName(card.name.split('//')[0]);
          if (!typeMap[front]) {
            typeMap[front] = card.type_line;
          }
        }
        count++;
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  console.log(`Parsed ${count} unique oracle cards. Saving ${typeMapFile}...`);
  fs.writeFileSync(typeMapFile, JSON.stringify(typeMap));
  const stats = fs.statSync(typeMapFile);
  console.log(`Successfully generated ${typeMapFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB).`);

  // Now update cards.db
  console.log(`Opening database ${dbPath} to add type_line column and populate data...`);
  const db = new DatabaseSync(dbPath);

  // Check if type_line column exists in cards table
  const tableInfo = db.prepare("PRAGMA table_info(cards)").all();
  const hasTypeCol = tableInfo.some(c => c.name === 'type_line');
  if (!hasTypeCol) {
    console.log("Adding column 'type_line' to 'cards' table...");
    db.exec("ALTER TABLE cards ADD COLUMN type_line TEXT;");
  }

  console.log("Updating type_line in cards table...");
  db.exec("BEGIN TRANSACTION;");
  const updateStmt = db.prepare("UPDATE cards SET type_line = ? WHERE clean_name = ?");

  let updatedCount = 0;
  for (const [cName, tLine] of Object.entries(typeMap)) {
    const res = updateStmt.run(tLine, cName);
    updatedCount += res.changes;
  }
  db.exec("COMMIT;");

  console.log(`Updated ${updatedCount} rows in cards table with type_line!`);

  // Index type_line for fast LIKE / exact queries
  console.log("Creating index on type_line...");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cards_type_line ON cards (type_line);");

  // Sample check: count dinosaur cards
  const dinoCheck = db.prepare("SELECT count(*) as c FROM cards WHERE type_line LIKE '%dinosaur%'").get();
  console.log(`Total Dinosaur cards in database: ${dinoCheck.c}`);

  // Sample check: count land cards
  const landCheck = db.prepare("SELECT count(*) as c FROM cards WHERE type_line LIKE '%land%'").get();
  console.log(`Total Land cards in database: ${landCheck.c}`);

  console.log("Database update complete!");
}

run().catch(err => {
  console.error("Error generating type map:", err);
  process.exit(1);
});
