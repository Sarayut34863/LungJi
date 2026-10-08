import editionCodesData from "@/data/edition-codes.json";
import type { CKCard } from "./cardkingdom";

export const editionCodes = editionCodesData as Record<string, string>;

export interface FormatArchidektOptions {
  quantity?: number;
  useStockQty?: boolean;
}

export function extractSetCodeFromCard(card: CKCard): string {
  const edLower = (card.edition || "").toLowerCase().trim();
  if (edLower === "promotional" || edLower === "promo pack" || edLower.startsWith("promotional")) {
    return "";
  }

  // Mystery Booster / The List
  if (card.edition === "Mystery Booster/The List") {
    return "plst";
  }

  // Also check SKU prefix
  let skuCode = "";
  if (card.sku && card.sku.includes("-")) {
    const rawPrefix = card.sku.split("-")[0].toUpperCase();

    if (rawPrefix.length === 3) {
      skuCode = rawPrefix.toLowerCase();
    } else if (rawPrefix.startsWith("SFFIC")) {
      skuCode = "fic";
    } else if (rawPrefix.startsWith("SFF")) {
      skuCode = rawPrefix.slice(3).toLowerCase();
    } else if (rawPrefix.startsWith("SF") || rawPrefix.startsWith("RF")) {
      skuCode = rawPrefix.slice(2).toLowerCase();
    } else if (rawPrefix.length === 4 && (rawPrefix.startsWith("F") || rawPrefix.startsWith("T"))) {
      skuCode = rawPrefix.slice(1).toLowerCase();
    } else if (rawPrefix.startsWith("M") && rawPrefix.length === 4) {
      skuCode = "plst";
    }
  }

  if (skuCode === "muma") return "plst";

  // If SKU gave a clean 3-character alphanumeric set code, prefer it!
  // (e.g. SLP for Secret Lair Prize/Promo vs SLD, MOC for March of the Machine Commander vs MOM, FIC vs FIN)
  if (skuCode && skuCode.length === 3 && /^[a-z0-9]{3}$/.test(skuCode)) {
    return skuCode;
  }

  // If edition is mapped in editionCodes, fallback to it
  let mapCode = (editionCodes[card.edition] || "").toLowerCase().trim();
  if (mapCode === "muma") mapCode = "plst";

  return mapCode || skuCode;
}

export function formatArchidektCard(
  card: CKCard,
  options?: FormatArchidektOptions
): string {
  // Quantity determination
  let qty = options?.quantity ?? 1;
  if (options?.useStockQty && typeof card.qty_retail === "number" && card.qty_retail > 0) {
    qty = card.qty_retail;
  }

  const cleanCode = extractSetCodeFromCard(card);

  // Collector number determination (Archidekt requires collector number to match exact printing)
  let colNum = "";
  if (cleanCode === "plst" && card.sku) {
    // e.g. MWAR-0184 -> WAR-184, MA25-007 -> A25-7
    colNum = card.sku.replace(/^M/, "").replace(/^([A-Za-z0-9]+)-0+(\d+)$/, "$1-$2");
  } else if (typeof card.collector_number === "number" && card.collector_number > 0 && card.collector_number < 900000) {
    colNum = String(card.collector_number);
  } else if (card.sku && card.sku.includes("-")) {
    const parts = card.sku.split("-");
    const numPart = parts.slice(1).join("-");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 900000) {
      colNum = String(parsed);
    } else if (numPart) {
      colNum = numPart;
    }
  }

  const isFoil = card.is_foil === "true" || card.is_foil === true || String(card.is_foil) === "1";
  const foilTag = isFoil ? " *F*" : "";

  // If we have a valid set code, include (set) and collector number if present
  if (cleanCode) {
    const colTag = colNum ? ` ${colNum}` : "";
    return `${qty}x ${card.name} (${cleanCode})${colTag}${foilTag}`;
  }

  // Without a valid set code (e.g. generic promotional cards), omit set and collector number so Archidekt matches cleanly by name
  return `${qty}x ${card.name}${foilTag}`;
}
