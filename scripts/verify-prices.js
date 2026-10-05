const https = require('https');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'cards.db');
const db = new DatabaseSync(dbPath);

console.log("Fetching live Card Kingdom feed to verify 100% price match...");

https.get('https://api.cardkingdom.com/api/v2/pricelist', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, res => {
  let stream = res;
  if (res.headers['content-encoding'] === 'gzip') {
    stream = res.pipe(zlib.createGunzip());
  }

  const chunks = [];
  stream.on('data', chunk => chunks.push(chunk));

  stream.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const parsed = JSON.parse(raw);
    const ckCards = parsed.data || [];
    console.log(`Live Card Kingdom cards loaded: ${ckCards.length}`);
    console.log(`Live Feed Created At: ${parsed.meta?.created_at}`);

    // Check meta table in local DB
    const localMeta = db.prepare("SELECT * FROM meta").all();
    console.log("Local DB Meta:", localMeta);

    // Let's test a sample of 2,000 cards across the catalog
    let matched = 0;
    let mismatched = 0;
    let missingInDb = 0;
    const mismatches = [];

    const getCardStmt = db.prepare("SELECT id, name, edition, is_foil, price_retail, price_buy, condition_values FROM cards WHERE id = ?");

    // Sample across the entire list
    const step = Math.max(1, Math.floor(ckCards.length / 5000)); // check 5,000 cards
    let sampleCount = 0;

    for (let i = 0; i < ckCards.length; i += step) {
      sampleCount++;
      const ck = ckCards[i];
      const local = getCardStmt.get(ck.id);

      if (!local) {
        missingInDb++;
        continue;
      }

      const ckPrice = parseFloat(ck.price_retail) || 0;
      const localPrice = parseFloat(local.price_retail) || 0;

      // Compare price with 0.001 tolerance for floating point
      if (Math.abs(ckPrice - localPrice) > 0.001) {
        mismatched++;
        if (mismatches.length < 10) {
          mismatches.push({
            id: ck.id,
            name: ck.name,
            edition: ck.edition,
            is_foil: ck.is_foil,
            ckPrice,
            localPrice
          });
        }
      } else {
        matched++;
      }
    }

    console.log("\n================ VERIFICATION RESULT ================");
    console.log(`Total sample cards checked: ${sampleCount}`);
    console.log(`100% Price Matched: ${matched} (${((matched / (matched + mismatched)) * 100).toFixed(2)}%)`);
    console.log(`Mismatched: ${mismatched}`);
    console.log(`Missing in local DB: ${missingInDb}`);
    if (mismatches.length > 0) {
      console.log("Sample mismatches:", mismatches);
    }

    // Now test famous cards specifically
    console.log("\n--- Checking Famous / Iconic Cards specifically ---");
    const testNames = [
      "Diresight",
      "Black Lotus",
      "Sheoldred, the Apocalypse",
      "Ragavan, Nimble Pilferer",
      "Sol Ring",
      "The One Ring",
      "Orcish Bowmasters",
      "Mana Crypt",
      "Mox Diamond",
      "Force of Will"
    ];

    testNames.forEach(name => {
      const liveItems = ckCards.filter(c => c.name.toLowerCase() === name.toLowerCase());
      if (liveItems.length > 0) {
        const item = liveItems[0];
        const local = getCardStmt.get(item.id);
        const match = local && Math.abs((parseFloat(item.price_retail) || 0) - (parseFloat(local.price_retail) || 0)) < 0.001;
        console.log(`[${name}] Edition: "${item.edition}" | CK: $${item.price_retail} | Local DB: $${local?.price_retail} | MATCH: ${match ? 'YES' : 'NO'}`);
      }
    });

    // Check live production endpoint on Vercel for 3 cards
    console.log("\n--- Verifying Live Production Vercel Website ---");
    const probeCards = ["Diresight", "Sol Ring", "Ragavan, Nimble Pilferer"];
    for (const cardName of probeCards) {
      try {
        const res = await fetch(`https://lungji.vercel.app/api/cards?search=${encodeURIComponent(cardName)}`);
        const json = await res.json();
        const found = json.cards?.[0];
        console.log(`Vercel Production [${cardName}]: $${found?.price_retail} (Edition: ${found?.edition})`);
      } catch (e) {
        console.error("Vercel probe error:", e.message);
      }
    }
  });
});
