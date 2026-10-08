import editionCodesData from "@/data/edition-codes.json";
import type { CKCard } from "./cardkingdom";

export const editionCodes = editionCodesData as Record<string, string>;

export interface FormatArchidektOptions {
  quantity?: number;
  useStockQty?: boolean;
}

export function extractSetCodeFromCard(card: CKCard): string {
  // If edition is mapped in editionCodes, check it
  let mapCode = (editionCodes[card.edition] || "").toLowerCase().trim();
  if (mapCode === "muma") mapCode = "plst";

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

  // Mystery Booster / The List
  if (card.edition === "Mystery Booster/The List" || skuCode === "muma" || mapCode === "plst") {
    return "plst";
  }

  // If card is from a Commander deck or SKU is standard 3-char code, prefer SKU code if available
  if (skuCode && skuCode.length === 3) {
    if (card.edition.toLowerCase().includes("commander") || skuCode.endsWith("c")) {
      return skuCode;
    }
  }

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

  const setTag = cleanCode ? ` (${cleanCode})` : "";
  const colTag = colNum ? ` ${colNum}` : "";

  // Note: Archidekt does not use trailing " F" for foils in text deck import (causes syntax error)
  return `${qty}x ${card.name}${setTag}${colTag}`;
}
