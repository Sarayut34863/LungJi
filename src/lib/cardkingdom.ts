import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export type CKRarity = "mythic" | "rare" | "uncommon" | "common" | "special";

export interface CardConditionValues {
  nm_price?: string;
  nm_qty?: number;
  ex_price?: string;
  ex_qty?: number;
  vg_price?: string;
  vg_qty?: number;
  g_price?: string;
  g_qty?: number;
}

export interface CKCard {
  id: number;
  sku: string;
  scryfall_id: string;
  url: string;
  name: string;
  variation: string;
  edition: string;
  is_foil: string | boolean;
  rarity?: CKRarity;
  price_retail: string;
  qty_retail: number;
  price_buy: string;
  qty_buying: number;
  condition_values?: CardConditionValues;
}

export interface EditionSummary {
  name: string;
  count: number;
  isPopular?: boolean;
}

export interface SearchParams {
  edition?: string;
  search?: string;
  foil?: "all" | "foil" | "nonfoil";
  rarity?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_desc" | "price_asc" | "buy_desc" | "name_asc";
  page?: number;
  limit?: number;
}

const POPULAR_SET_NAMES = [
  "Foundations",
  "Bloomburrow",
  "Modern Horizons 3",
  "Outlaws of Thunder Junction",
  "Murders at Karlov Manor",
  "The Lost Caverns of Ixalan",
  "Wilds of Eldraine",
  "March of the Machine",
  "Phyrexia: All Will Be One",
  "The Brothers' War",
  "Dominaria United",
  "Commander Masters",
  "Kamigawa: Neon Dynasty",
  "Modern Horizons 2",
  "Commander 2024",
  "Alpha",
  "Beta",
  "Unlimited",
  "Revised Edition",
];

const DB_SOURCE_PATH = path.join(process.cwd(), "src", "data", "cards.db");

function getEffectiveDbPath(): string {
  // In Vercel / AWS Lambda, /tmp is an ultra-fast in-memory writable tmpfs
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = path.join("/tmp", "cards.db");
    if (!fs.existsSync(tmpPath)) {
      if (fs.existsSync(DB_SOURCE_PATH)) {
        try {
          fs.copyFileSync(DB_SOURCE_PATH, tmpPath);
        } catch (e) {
          console.warn("Failed to copy cards.db to /tmp:", e);
        }
      }
    }
    if (fs.existsSync(tmpPath)) {
      return tmpPath;
    }
  }
  return DB_SOURCE_PATH;
}

let dbInstance: DatabaseSync | null = null;
export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const activePath = getEffectiveDbPath();
    if (!fs.existsSync(activePath)) {
      throw new Error(`cards.db not found at ${activePath}`);
    }

    try {
      dbInstance = new DatabaseSync(activePath);
      dbInstance.exec("PRAGMA temp_store = MEMORY;");
    } catch {
      dbInstance = new DatabaseSync(activePath, { readOnly: true });
      dbInstance.exec("PRAGMA temp_store = MEMORY;");
    }
  }
  return dbInstance;
}

// Ultra-fast In-Memory LRU/TTL Cache for searchCards
interface SearchCacheEntry {
  data: any;
  expires: number;
}
const searchCache = new Map<string, SearchCacheEntry>();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

function getCachedResult(key: string) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResult(key: string, data: any) {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(searchCache.keys()).slice(0, 50);
    for (const k of keysToDelete) searchCache.delete(k);
  }
  searchCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

function escapeFTS5(q: string): string {
  const cleaned = q.replace(/[*"?^{}]/g, " ").trim();
  if (!cleaned) return "";
  return `"${cleaned.replace(/"/g, '""')}"`;
}

let editionsCache: {
  editions: EditionSummary[];
  popularEditions: EditionSummary[];
  totalCards: number;
  meta: { created_at: string; base_url: string };
} | null = null;

export async function getEditions() {
  if (editionsCache) return editionsCache;
  const db = getDb();
  
  const rows = db.prepare(
    "SELECT edition, COUNT(*) as count FROM cards GROUP BY edition ORDER BY count DESC"
  ).all() as unknown as { edition: string; count: number }[];

  const allEditions: EditionSummary[] = rows
    .map((r) => ({
      name: r.edition,
      count: r.count,
      isPopular: POPULAR_SET_NAMES.includes(r.edition),
    }))
    .sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return b.count - a.count;
    });

  const popularEditions = allEditions.filter((e) => e.isPopular);

  const countRow = db.prepare("SELECT COUNT(*) as total FROM cards").get() as unknown as { total: number };
  const totalCards = countRow?.total || 0;

  const meta = {
    created_at: new Date().toISOString(),
    base_url: "https://www.cardkingdom.com/",
  };

  try {
    const metaRows = db.prepare("SELECT key, value FROM meta").all() as unknown as { key: string; value: string }[];
    const metaMap = new Map(metaRows.map((r) => [r.key, r.value]));
    if (metaMap.has("created_at")) meta.created_at = metaMap.get("created_at")!;
    if (metaMap.has("base_url")) meta.base_url = metaMap.get("base_url")!;
  } catch {}

  editionsCache = {
    editions: allEditions,
    popularEditions,
    totalCards,
    meta,
  };
  return editionsCache;
}

export async function searchCards(params: SearchParams) {
  // Check in-memory cache for instant 0.00ms response under high concurrency
  const cacheKey = JSON.stringify(params);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return cached;
  }

  const db = getDb();
  const {
    edition,
    search,
    foil = "all",
    rarity = "all",
    inStock = false,
    minPrice,
    maxPrice,
    sortBy = "price_desc",
    page = 1,
    limit = 24,
  } = params;

  const where: string[] = [];
  const binds: (string | number)[] = [];

  if (edition && edition !== "all") {
    where.push("edition = ?");
    binds.push(edition);
  }

  if (rarity && rarity !== "all") {
    const rList = rarity.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (rList.length > 0 && !rList.includes("all")) {
      where.push(`rarity IN (${rList.map(() => "?").join(",")})`);
      binds.push(...rList);
    }
  }

  if (search && search.trim() !== "") {
    const ftsQ = escapeFTS5(search);
    if (ftsQ) {
      where.push("id IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)");
      binds.push(ftsQ);
    } else {
      const q = `%${search.trim()}%`;
      where.push("(clean_name LIKE ? OR sku LIKE ?)");
      binds.push(q, q);
    }
  }

  if (foil === "foil") {
    where.push("is_foil = 1");
  } else if (foil === "nonfoil") {
    where.push("is_foil = 0");
  }

  if (minPrice !== undefined && !isNaN(minPrice)) {
    where.push("price_retail >= ?");
    binds.push(minPrice);
  }

  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    where.push("price_retail <= ?");
    binds.push(maxPrice);
  }

  if (inStock) {
    where.push("qty_retail > 0");
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  let orderClause = "ORDER BY price_retail DESC";
  if (sortBy === "price_asc") orderClause = "ORDER BY price_retail ASC";
  else if (sortBy === "buy_desc") orderClause = "ORDER BY price_buy DESC";
  else if (sortBy === "name_asc") orderClause = "ORDER BY name ASC";

  // Fast count query using index
  const countSql = `SELECT COUNT(*) as total FROM cards ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...binds) as unknown as { total: number } | undefined;
  const total = totalRow?.total || 0;

  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(limit, 250));
  const offset = (safePage - 1) * safeLimit;
  const totalPages = Math.ceil(total / safeLimit) || 1;

  // Fast paged query using index
  const dataSql = `SELECT * FROM cards ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;
  const rows = db.prepare(dataSql).all(...binds, safeLimit, offset) as unknown as {
    id: number;
    sku: string | null;
    scryfall_id: string | null;
    name: string;
    clean_name: string;
    edition: string;
    variation: string | null;
    is_foil: number;
    rarity: CKRarity | null;
    price_retail: number;
    qty_retail: number;
    price_buy: number;
    qty_buying: number;
    url: string | null;
    condition_values: string | null;
  }[];

  const cards: CKCard[] = rows.map((r) => {
    let conds: CardConditionValues | undefined;
    if (r.condition_values) {
      try {
        conds = JSON.parse(r.condition_values);
      } catch {}
    }
    return {
      id: r.id,
      sku: r.sku || "",
      scryfall_id: r.scryfall_id || "",
      url: r.url || "",
      name: r.name,
      variation: r.variation || "",
      edition: r.edition,
      is_foil: r.is_foil === 1 ? "true" : "false",
      rarity: r.rarity || undefined,
      price_retail: typeof r.price_retail === "number" ? r.price_retail.toFixed(2) : String(r.price_retail),
      qty_retail: r.qty_retail || 0,
      price_buy: typeof r.price_buy === "number" ? r.price_buy.toFixed(2) : String(r.price_buy),
      qty_buying: r.qty_buying || 0,
      condition_values: conds,
    };
  });

  const editionsData = await getEditions();

  const responseData = {
    cards,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    selectedEdition: edition || "all",
    meta: editionsData.meta,
  };

  setCachedResult(cacheKey, responseData);
  return responseData;
}

export async function fetchCKData(forceRefresh = false) {
  if (forceRefresh) {
    editionsCache = null;
    searchCache.clear();
  }
  return getEditions();
}
