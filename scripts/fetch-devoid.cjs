const https = require('https');
const fs = require('fs');
const path = require('path');

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

async function getDevoidCards() {
  let url = 'https://api.scryfall.com/cards/search?q=keyword%3Adevoid';
  const cards = [];
  while (url) {
    console.log('Fetching', url);
    const res = await fetchUrl(url);
    if (res.data) {
      cards.push(...res.data);
    }
    url = res.has_more ? res.next_page : null;
  }
  console.log('Total fetched:', cards.length);

  const WUBRG_ORDER = { W: 0, U: 1, B: 2, R: 3, G: 4 };

  const map = {};
  for (const c of cards) {
    const key = c.name.toLowerCase().trim();
    // Parse mana cost or color_identity
    const manaColors = [];
    const matches = c.mana_cost ? c.mana_cost.match(/[WUBRG]/g) : [];
    if (matches) {
      for (const m of matches) {
        if (!manaColors.includes(m)) manaColors.push(m);
      }
    } else if (c.color_identity && c.color_identity.length > 0) {
      for (const col of c.color_identity) {
        if (!manaColors.includes(col)) manaColors.push(col);
      }
    }
    manaColors.sort((a, b) => (WUBRG_ORDER[a] ?? 9) - (WUBRG_ORDER[b] ?? 9));

    let color = 'C';
    let order = 7;
    if (manaColors.length === 1) {
      color = manaColors[0];
      order = WUBRG_ORDER[color] ?? 7;
    } else if (manaColors.length > 1) {
      color = manaColors.join('');
      order = 5; // Multi
    }

    map[key] = {
      name: c.name,
      mana_cost: c.mana_cost,
      color,
      order,
    };
  }

  console.log('Processed', Object.keys(map).length, 'devoid cards.');
  const outPath = path.join(__dirname, '..', 'src', 'data', 'devoid-colors.json');
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log('Saved to', outPath);
}

getDevoidCards().catch(console.error);
