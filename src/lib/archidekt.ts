import editionCodesData from "@/data/edition-codes.json";
import type { CKCard } from "./cardkingdom";

export const editionCodes = editionCodesData as Record<string, string>;

export interface FormatArchidektOptions {
  quantity?: number;
  useStockQty?: boolean;
  includeCollectorNumber?: boolean;
}

export function formatArchidektCard(
  card: CKCard,
  options?: FormatArchidektOptions
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
