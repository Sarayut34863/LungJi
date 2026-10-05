import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', 'src', 'data');
const outputFile = path.join(outputDir, 'rarity-map.json');

const RARITY_MAP = {
  mythic: 'm',
  rare: 'r',
  uncommon: 'u',
  common: 'c',
  special: 's',
  bonus: 's',
};

async function run() {
  console.log('Fetching Scryfall bulk metadata...');
  const metaRes = await fetch('https://api.scryfall.com/bulk-data', {
    headers: { 'User-Agent': 'LungJi/1.0', Accept: 'application/json' },
  });
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch Scryfall bulk metadata: ${metaRes.status}`);
  }
  const metaJson = await metaRes.json();
  const bulkObj = metaJson.data.find((x) => x.type === 'default_cards');
  if (!bulkObj || !bulkObj.jsonl_download_uri) {
    throw new Error('Default cards bulk object not found');
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

  const rarityDict = {};
  let count = 0;
  for await (const line of rl) {
    if (!line) continue;
    try {
      const card = JSON.parse(line);
      if (card.id && card.rarity) {
        rarityDict[card.id] = RARITY_MAP[card.rarity.toLowerCase()] || card.rarity[0];
        count++;
      }
    } catch {
      // ignore
    }
  }

  console.log(`Parsed ${count} cards. Ensuring output directory exists: ${outputDir}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Writing rarity mapping to ${outputFile}...`);
  fs.writeFileSync(outputFile, JSON.stringify(rarityDict));
  const stats = fs.statSync(outputFile);
  console.log(`Successfully generated ${outputFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${count} cards).`);
}

run().catch((err) => {
  console.error('Error generating rarity map:', err);
  process.exit(1);
});
