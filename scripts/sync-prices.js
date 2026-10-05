const https = require('https');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'cards.db');

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

async function run() {
  const jsonStr = await downloadPricelist();
  console.log("Parsing JSON...");
  const parsed = JSON.parse(jsonStr);

  const meta = parsed.meta || {};
  const data = parsed.data || [];
  console.log(`Loaded ${data.length} cards from Card Kingdom.`);
  console.log("Card Kingdom Meta Created At:", meta.created_at);

  console.log("Opening SQLite database:", dbPath);
  const db = new DatabaseSync(dbPath);

  console.log("Starting bulk price update...");
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

  let updatedCount = 0;
  let skippedCount = 0;

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
      skippedCount++;
    }
  }

  // Update meta table
  const metaStmt = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  metaStmt.run("created_at", meta.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19));
  if (meta.base_url) metaStmt.run("base_url", meta.base_url);
  metaStmt.run("total_cards", String(data.length));

  db.exec("COMMIT;");
  console.log(`Done! Successfully updated ${updatedCount} cards in cards.db (${skippedCount} new/skipped).`);
  console.log("Meta table updated with timestamp:", meta.created_at);
}

run().catch(console.error);
