import editionCodesData from "@/data/edition-codes.json";
import type { CKCard } from "./cardkingdom";

export const editionCodes = editionCodesData as Record<string, string>;

export interface FormatArchidektOptions {
  quantity?: number;
  useStockQty?: boolean;
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

  // Set code lookup
  let code = editionCodes[card.edition] || "";
  if (!code && card.sku) {
    const rawPrefix = card.sku.split("-")[0] || "";
    code = rawPrefix.replace(/^[FS]+/, "");
  }
  let cleanCode = code ? code.toLowerCase().trim() : "";

  // Special case for Mystery Booster / The List (Archidekt uses 'plst')
  if (card.edition === "Mystery Booster/The List" || cleanCode === "muma") {
    cleanCode = "plst";
  }

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
