const https = require('https');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LungJiApp/1.0', 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Step 1: Fetching Full Art Basic Land IDs from Scryfall ---');
  let url = 'https://api.scryfall.com/cards/search?q=is%3Afullart+t%3Abasic&unique=prints';
  const fullArtIds = new Set();
  while (url) {
    console.log('Fetching', url);
    const res = await fetchUrl(url);
    if (res.data) {
      for (const c of res.data) {
        fullArtIds.add(c.id);
      }
    }
    url = res.has_more ? res.next_page : null;
  }
  console.log(`Fetched ${fullArtIds.size} full art basic land Scryfall IDs.`);

  const dbPath = path.join(__dirname, '..', 'src', 'data', 'cards.db');
  const colorMapPath = path.join(__dirname, '..', 'src', 'data', 'color-map.json');
  const devoidPath = path.join(__dirname, '..', 'src', 'data', 'devoid-colors.json');

  const db = new DatabaseSync(dbPath);

  // Check columns
  console.log('--- Step 2: Ensuring DB Columns ---');
  const tableInfo = db.prepare('PRAGMA table_info(cards)').all();
  const columnNames = new Set(tableInfo.map(c => c.name));

  if (!columnNames.has('is_full_art_land')) {
    console.log('Adding column is_full_art_land...');
    db.exec('ALTER TABLE cards ADD COLUMN is_full_art_land INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnNames.has('is_devoid')) {
    console.log('Adding column is_devoid...');
    db.exec('ALTER TABLE cards ADD COLUMN is_devoid INTEGER NOT NULL DEFAULT 0;');
  }

  console.log('--- Step 3: Updating Basic Lands in cards.db ---');
  const basicNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes', 'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp', 'Snow-Covered Mountain', 'Snow-Covered Forest'];

  const lands = db.prepare(`
    SELECT id, sku, scryfall_id, name, clean_name, edition, variation
    FROM cards
    WHERE clean_name IN (${basicNames.map(() => '?').join(',')})
  `).all(...basicNames);

  console.log(`Found ${lands.length} basic lands in DB.`);

  db.exec('BEGIN TRANSACTION;');

  const updateFullArtStmt = db.prepare('UPDATE cards SET is_full_art_land = ? WHERE id = ?');
  let fullArtCount = 0;
  let regularCount = 0;

  for (const l of lands) {
    const isScryfallFullArt = l.scryfall_id && fullArtIds.has(l.scryfall_id);
    const v = l.variation || '';
    const ed = l.edition || '';
    const isKeywordFullArt = /full[ -]?art|borderless|showcase|retro|guru|apac|euro|unhinged|unglued|unstable|unfinity|galaxy|oil[ -]?slick|dracula|godzilla|dungeon|map|constellation|japanese|phyrexian/i.test(v) ||
      /unhinged|unglued|unstable|unfinity|unsanctioned|secret lair/i.test(ed);

    const isFullArt = (isScryfallFullArt || isKeywordFullArt) ? 1 : 0;
    if (isFullArt) fullArtCount++;
    else regularCount++;

    updateFullArtStmt.run(isFullArt, l.id);
  }

  console.log(`Tagged basic lands: Full Art: ${fullArtCount} | Regular: ${regularCount}`);

  console.log('--- Step 4: Updating Devoid cards in cards.db & color-map.json ---');
  const devoidMap = JSON.parse(fs.readFileSync(devoidPath, 'utf8'));
  const colorMap = fs.existsSync(colorMapPath) ? JSON.parse(fs.readFileSync(colorMapPath, 'utf8')) : {};

  const updateDevoidStmt = db.prepare(`
    UPDATE cards
    SET is_devoid = 1,
        color = ?,
        color_order = ?
    WHERE clean_name = ? COLLATE NOCASE
  `);

  let devoidUpdatedRows = 0;
  for (const [nameKey, info] of Object.entries(devoidMap)) {
    const res = updateDevoidStmt.run(info.color, info.order, info.name);
    devoidUpdatedRows += res.changes;

    // Update colorMap
    colorMap[nameKey] = {
      color: info.color,
      order: info.order,
      is_devoid: true,
    };
  }

  console.log(`Updated ${devoidUpdatedRows} Devoid card rows in cards.db.`);

  db.exec('COMMIT;');

  console.log('Saving updated color-map.json...');
  fs.writeFileSync(colorMapPath, JSON.stringify(colorMap, null, 2));

  console.log('--- Step 5: Creating DB Indexes ---');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cards_full_art_land ON cards (is_full_art_land);
    CREATE INDEX IF NOT EXISTS idx_cards_is_devoid ON cards (is_devoid);
    CREATE INDEX IF NOT EXISTS idx_cards_color_devoid ON cards (color, is_devoid);
  `);

  console.log('Migration complete successfully!');
}

run().catch(console.error);
