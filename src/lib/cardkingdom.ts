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
  collector_number?: number;
  color?: string;
  color_order?: number;
  type_line?: string;
}

import editionCodesData from "@/data/edition-codes.json";

const editionCodes = editionCodesData as Record<string, string>;

export interface EditionSummary {
  name: string;
  code?: string;
  count: number;
  isPopular?: boolean;
}

export interface SearchParams {
  edition?: string;
  search?: string;
  foil?: "all" | "foil" | "nonfoil";
  rarity?: string;
  color?: string;
  colorMode?: "exact" | "any";
  tokens?: "hide" | "show";
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
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
      code: editionCodes[r.edition] || undefined,
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
    color = "all",
    colorMode = "exact",
    inStock = false,
    minPrice,
    maxPrice,
    sortBy = "price_desc",
    page = 1,
    limit = 24,
  } = params;

  const where: string[] = [];
  const binds: (string | number)[] = [];

  // Tokens filter (Default: hide tokens - ซ่อน token ไว้เป็นค่าเริ่มต้น)
  if (params.tokens !== "show") {
    where.push("clean_name NOT LIKE '%token%' AND edition NOT LIKE '%token%'");
  }

  if (edition && edition !== "all") {
    let targetEdition = edition.trim();
    const upper = targetEdition.toUpperCase();
    for (const [name, code] of Object.entries(editionCodes)) {
      if (code === upper || name.toLowerCase() === targetEdition.toLowerCase()) {
        targetEdition = name;
        break;
      }
    }
    where.push("edition = ?");
    binds.push(targetEdition);
  }

  if (rarity && rarity !== "all") {
    const rList = rarity.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (rList.length > 0 && !rList.includes("all")) {
      where.push(`rarity IN (${rList.map(() => "?").join(",")})`);
      binds.push(...rList);
    }
  }

  if (color && color !== "all") {
    const rawTokens = color.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    const WUBRG = ["W", "U", "B", "R", "G"];
    const WUBRG_ORDER: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

    const hasM = rawTokens.includes("M");
    const manaColors: string[] = [];
    const specialColors: string[] = [];

    for (const tok of rawTokens) {
      if (tok === "C" || tok === "L") {
        if (!specialColors.includes(tok)) specialColors.push(tok);
      } else if (tok === "M") {
        // Handled via hasM flag
      } else if (tok.length === 1 && WUBRG.includes(tok)) {
        if (!manaColors.includes(tok)) manaColors.push(tok);
      } else if (tok.length > 1) {
        for (const ch of tok) {
          if (WUBRG.includes(ch) && !manaColors.includes(ch)) {
            manaColors.push(ch);
          }
        }
      }
    }

    manaColors.sort((a, b) => (WUBRG_ORDER[a] ?? 9) - (WUBRG_ORDER[b] ?? 9));
    const combo = manaColors.join("");

    if (hasM) {
      // User requested M (Multicolor - all combinations with 2 or more colors)
      if (manaColors.length === 0 && specialColors.length === 0) {
        where.push("length(color) >= 2");
      } else if (manaColors.length > 0 && specialColors.length === 0) {
        if (colorMode === "any") {
          where.push(`(color IN (${manaColors.map(() => "?").join(",")}) OR length(color) >= 2)`);
          binds.push(...manaColors);
        } else {
          // In Mix mode with M + specific colors: multicolor cards that contain all specified colors
          const likes = manaColors.map(() => "color LIKE ?").join(" AND ");
          where.push(`(length(color) >= 2 AND ${likes})`);
          binds.push(...manaColors.map((c) => `%${c}%`));
        }
      } else if (manaColors.length === 0 && specialColors.length > 0) {
        where.push(`(length(color) >= 2 OR color IN (${specialColors.map(() => "?").join(",")}))`);
        binds.push(...specialColors);
      } else {
        if (colorMode === "any") {
          const allTargets = [...manaColors, ...specialColors];
          where.push(`(color IN (${allTargets.map(() => "?").join(",")}) OR length(color) >= 2)`);
          binds.push(...allTargets);
        } else {
          const likes = manaColors.map(() => "color LIKE ?").join(" AND ");
          where.push(`((length(color) >= 2 AND ${likes}) OR color IN (${specialColors.map(() => "?").join(",")}))`);
          binds.push(...manaColors.map((c) => `%${c}%`), ...specialColors);
        }
      }
    } else {
      // Standard color filtering without M
      if (manaColors.length > 0 && specialColors.length === 0) {
        if (manaColors.length === 1) {
          where.push("color = ?");
          binds.push(manaColors[0]);
        } else {
          if (colorMode === "any") {
            const targets = [...manaColors, combo];
            where.push(`color IN (${targets.map(() => "?").join(",")})`);
            binds.push(...targets);
          } else {
            where.push("color = ?");
            binds.push(combo);
          }
        }
      } else if (specialColors.length > 0 && manaColors.length === 0) {
        where.push(`color IN (${specialColors.map(() => "?").join(",")})`);
        binds.push(...specialColors);
      } else if (manaColors.length > 0 && specialColors.length > 0) {
        const targets = manaColors.length === 1 ? [manaColors[0], ...specialColors] : [combo, ...specialColors];
        where.push(`color IN (${targets.map(() => "?").join(",")})`);
        binds.push(...targets);
      }
    }
  }

  if (search && search.trim() !== "") {
    let cleanSearch = search.trim();

    // Parse Archidekt / Scryfall syntax for types: t:dinosaur or type:"legendary creature"
    const typeRegex = /(?:t|type):(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi;
    const typeFilters: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = typeRegex.exec(cleanSearch)) !== null) {
      const term = (match[1] || match[2] || match[3] || "").trim();
      if (term) {
        typeFilters.push(term);
      }
    }

    cleanSearch = cleanSearch.replace(typeRegex, "").trim();

    for (const tTerm of typeFilters) {
      where.push("type_line LIKE ?");
      binds.push(`%${tTerm}%`);
    }

    if (cleanSearch !== "") {
      const ftsQ = escapeFTS5(cleanSearch);
      if (ftsQ) {
        where.push("id IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)");
        binds.push(ftsQ);
      } else {
        const q = `%${cleanSearch}%`;
        where.push("(clean_name LIKE ? OR sku LIKE ?)");
        binds.push(q, q);
      }
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

  function parseSortOrder(sort: string = "price_desc"): string {
    switch (sort) {
      case "price_desc":
        return "ORDER BY price_retail DESC, name ASC";
      case "price_asc":
        return "ORDER BY price_retail ASC, name ASC";
      case "buy_desc":
        return "ORDER BY price_buy DESC, name ASC";
      case "name_asc":
        return "ORDER BY name ASC";
      case "name_desc":
        return "ORDER BY name DESC";
      case "number_asc":
      case "collector_asc":
        return "ORDER BY collector_number ASC, price_retail DESC";
      case "number_desc":
      case "collector_desc":
        return "ORDER BY collector_number DESC, price_retail DESC";
      case "color_asc":
      case "color_wubrg":
        return "ORDER BY color_order ASC, collector_number ASC, name ASC";
      case "color_desc":
        return "ORDER BY color_order DESC, collector_number ASC, name ASC";
      case "color_price_desc":
        return "ORDER BY color_order ASC, price_retail DESC, name ASC";
      case "color_price_asc":
        return "ORDER BY color_order ASC, price_retail ASC, name ASC";
      case "color_number_asc":
        return "ORDER BY color_order ASC, collector_number ASC, price_retail DESC";
      case "number_price_desc":
        return "ORDER BY collector_number ASC, price_retail DESC";
      case "price_number_asc":
        return "ORDER BY price_retail DESC, collector_number ASC";
    }

    // Flexible multi-sort parser for comma-separated tokens (e.g. "color_asc,price_desc")
    const clauses: string[] = [];
    const parts = sort.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const part of parts) {
      if (part === "color" || part === "color_asc" || part === "color_order" || part === "color_order_asc") {
        clauses.push("color_order ASC");
      } else if (part === "color_desc" || part === "color_order_desc") {
        clauses.push("color_order DESC");
      } else if (part === "price" || part === "price_desc" || part === "price_retail_desc") {
        clauses.push("price_retail DESC");
      } else if (part === "price_asc" || part === "price_retail_asc") {
        clauses.push("price_retail ASC");
      } else if (part === "number" || part === "number_asc" || part === "collector" || part === "collector_asc") {
        clauses.push("collector_number ASC");
      } else if (part === "number_desc" || part === "collector_desc") {
        clauses.push("collector_number DESC");
      } else if (part === "name" || part === "name_asc") {
        clauses.push("name ASC");
      } else if (part === "name_desc") {
        clauses.push("name DESC");
      } else if (part === "buy_desc") {
        clauses.push("price_buy DESC");
      }
    }

    if (clauses.length > 0) {
      return `ORDER BY ${Array.from(new Set(clauses)).join(", ")}`;
    }

    return "ORDER BY price_retail DESC, name ASC";
  }

  const orderClause = parseSortOrder(sortBy);

  // Fast count query using index
  const countSql = `SELECT COUNT(*) as total FROM cards ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...binds) as unknown as { total: number } | undefined;
  const total = totalRow?.total || 0;

  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(limit, 2000));
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
    collector_number: number | null;
    color: string | null;
    color_order: number | null;
    type_line: string | null;
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
      collector_number: typeof r.collector_number === "number" && r.collector_number < 900000 ? r.collector_number : undefined,
      color: r.color || undefined,
      color_order: typeof r.color_order === "number" ? r.color_order : undefined,
      type_line: r.type_line || undefined,
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

export function formatArchidektCard(
  card: CKCard,
  options?: {
    quantity?: number;
    useStockQty?: boolean;
    includeCollectorNumber?: boolean;
  }
): string {
  const isFoil = card.is_foil === "true" || card.is_foil === true || String(card.is_foil) === "1";

  // Set code lookup
  let code = editionCodes[card.edition] || "";
  if (!code && card.sku) {
    const rawPrefix = card.sku.split("-")[0] || "";
    code = rawPrefix.replace(/^F/i, "");
  }
  const cleanCode = code ? code.toLowerCase().trim() : "";

  // Quantity determination
  let qty = options?.quantity ?? 1;
  if (options?.useStockQty && typeof card.qty_retail === "number" && card.qty_retail > 0) {
    qty = card.qty_retail;
  }

  // Collector number (optional or included if available)
  let colNum = "";
  if (options?.includeCollectorNumber) {
    if (typeof card.collector_number === "number" && card.collector_number < 900000) {
      colNum = ` ${card.collector_number}`;
    } else if (card.sku && card.sku.includes("-")) {
      const parts = card.sku.split("-");
      const numPart = parseInt(parts.slice(1).join("-"), 10);
      if (!isNaN(numPart) && numPart < 900000) {
        colNum = ` ${numPart}`;
      }
    }
  }

  const foilTag = isFoil ? " F" : "";
  const setTag = cleanCode ? ` (${cleanCode})` : "";

  return `${qty}x ${card.name}${setTag}${colNum}${foilTag}`;
}
