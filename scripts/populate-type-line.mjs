import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');
const typeMapFile = path.join(dataDir, 'type-map.json');
const dbPath = path.join(dataDir, 'cards.db');

console.log("Reading type-map.json...");
const typeMap = JSON.parse(fs.readFileSync(typeMapFile, 'utf8'));

console.log("Opening cards.db...");
const db = new DatabaseSync(dbPath);

const tableInfo = db.prepare("PRAGMA table_info(cards)").all();
const hasTypeCol = tableInfo.some(c => c.name === 'type_line');
if (!hasTypeCol) {
  console.log("Adding column 'type_line'...");
  db.exec("ALTER TABLE cards ADD COLUMN type_line TEXT;");
}

console.log("Creating index on lower(clean_name)...");
db.exec("CREATE INDEX IF NOT EXISTS idx_cards_lower_name ON cards (lower(clean_name));");

console.log("Bulk updating type_line...");
db.exec("BEGIN TRANSACTION;");
const updateStmt = db.prepare("UPDATE cards SET type_line = ? WHERE lower(clean_name) = ?");

let updatedCount = 0;
for (const [nameLower, tLine] of Object.entries(typeMap)) {
  const res = updateStmt.run(tLine, nameLower);
  updatedCount += res.changes;
}
db.exec("COMMIT;");

console.log(`Updated ${updatedCount} rows in cards table with type_line!`);

console.log("Creating index on type_line...");
db.exec("CREATE INDEX IF NOT EXISTS idx_cards_type_line ON cards (type_line);");

const dinoCount = db.prepare("SELECT count(*) as c FROM cards WHERE type_line LIKE '%dinosaur%'").get();
console.log(`Total Dinosaur cards in database: ${dinoCount.c}`);

const landCount = db.prepare("SELECT count(*) as c FROM cards WHERE type_line LIKE '%land%'").get();
console.log(`Total Land cards in database: ${landCount.c}`);

console.log("Done!");
