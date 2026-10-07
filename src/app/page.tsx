"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Search,
  Sparkles,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PackageX,
  Boxes,
  RotateCcw,
  Filter,
  ArrowUpDown,
  Check,
  Plus,
  Minus,
  Printer,
  Trash2,
  Layers,
  Settings2,
  FileText,
  CheckCircle2,
  Zap,
  MousePointer,
  Grid,
  SlidersHorizontal,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { CKCard, EditionSummary } from "@/lib/cardkingdom";

// Official Card Kingdom Castle Rook Icon (Archidekt / Card Kingdom Brand Icon)
export function CardKingdomIcon({ className = "w-3.5 h-2.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1450 1016"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M1206 346V1016H244V346H402V0H646V346H805V0H1049V346ZM244 0V346H0V0ZM1450 0V346H1206V0Z" />
    </svg>
  );
}

// Helper function to format price with commas (e.g. 149,999.99)
function formatPrice(num: number): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type SortFieldId = "color" | "price" | "number" | "name";

export interface ActiveSortItem {
  id: SortFieldId;
  direction: "asc" | "desc";
}

export const SORT_FIELD_CONFIG: Record<
  SortFieldId,
  {
    label: string;
    shortLabel: string;
    ascLabel: string;
    descLabel: string;
    defaultDir: "asc" | "desc";
  }
> = {
  color: {
    label: "Color (WUBRG)",
    shortLabel: "Color",
    ascLabel: "WUBRG",
    descLabel: "Land → W",
    defaultDir: "asc",
  },
  price: {
    label: "Price ($)",
    shortLabel: "Price",
    ascLabel: "Low → High",
    descLabel: "High → Low",
    defaultDir: "desc",
  },
  number: {
    label: "Collector Number",
    shortLabel: "Card #",
    ascLabel: "1 → 999",
    descLabel: "999 → 1",
    defaultDir: "asc",
  },
  name: {
    label: "Card Name",
    shortLabel: "Name",
    ascLabel: "A → Z",
    descLabel: "Z → A",
    defaultDir: "asc",
  },
};

export function parseSortStringToItems(sortStr: string): ActiveSortItem[] {
  if (!sortStr) return [{ id: "price", direction: "desc" }];
  const parts = sortStr.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const items: ActiveSortItem[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    let id: SortFieldId | null = null;
    let dir: "asc" | "desc" = "asc";

    if (part === "color" || part === "color_asc" || part === "color_wubrg" || part === "color_order" || part === "color_order_asc") {
      id = "color"; dir = "asc";
    } else if (part === "color_desc" || part === "color_order_desc") {
      id = "color"; dir = "desc";
    } else if (part === "price" || part === "price_desc" || part === "price_retail_desc") {
      id = "price"; dir = "desc";
    } else if (part === "price_asc" || part === "price_retail_asc") {
      id = "price"; dir = "asc";
    } else if (part === "number" || part === "number_asc" || part === "collector" || part === "collector_asc" || part === "collector_number" || part === "collector_number_asc") {
      id = "number"; dir = "asc";
    } else if (part === "number_desc" || part === "collector_desc" || part === "collector_number_desc") {
      id = "number"; dir = "desc";
    } else if (part === "name" || part === "name_asc") {
      id = "name"; dir = "asc";
    } else if (part === "name_desc") {
      id = "name"; dir = "desc";
    }

    if (id && !seen.has(id)) {
      seen.add(id);
      items.push({ id, direction: dir });
    }
  }

  // Handle legacy combo tokens like "color_price_desc"
  if (items.length === 0) {
    if (sortStr === "color_price_desc") {
      return [{ id: "color", direction: "asc" }, { id: "price", direction: "desc" }];
    } else if (sortStr === "color_price_asc") {
      return [{ id: "color", direction: "asc" }, { id: "price", direction: "asc" }];
    } else if (sortStr === "color_number_asc") {
      return [{ id: "color", direction: "asc" }, { id: "number", direction: "asc" }];
    } else if (sortStr === "number_price_desc") {
      return [{ id: "number", direction: "asc" }, { id: "price", direction: "desc" }];
    }
    return [{ id: "price", direction: "desc" }];
  }

  return items;
}

export function itemsToSortString(items: ActiveSortItem[]): string {
  if (items.length === 0) return "price_desc";
  return items.map((it) => `${it.id}_${it.direction}`).join(",");
}

export function DynamicMultiSortControl({
  sortBy,
  onChange,
  onReset,
  title = "Sort By",
  allowSelectionOrder = false,
}: {
  sortBy: string;
  onChange: (newSort: string) => void;
  onReset?: () => void;
  title?: string;
  allowSelectionOrder?: boolean;
}) {
  const isSelectionOrder = allowSelectionOrder && sortBy === "added";
  const activeItems = useMemo(() => {
    if (isSelectionOrder) return [];
    return parseSortStringToItems(sortBy);
  }, [sortBy, isSelectionOrder]);

  const handleToggleField = (fieldId: SortFieldId) => {
    const existingIndex = activeItems.findIndex((it) => it.id === fieldId);
    let newItems: ActiveSortItem[];

    if (existingIndex === -1) {
      // 1st click: Add to end of chain with default direction!
      const defaultDir = SORT_FIELD_CONFIG[fieldId].defaultDir;
      newItems = [...activeItems, { id: fieldId, direction: defaultDir }];
    } else {
      // Already selected in chain ("ซ้อนกัน"):
      const currentItem = activeItems[existingIndex];
      const defaultDir = SORT_FIELD_CONFIG[fieldId].defaultDir;

      if (currentItem.direction === defaultDir) {
        // 2nd click: Toggle direction!
        const toggledDir = defaultDir === "asc" ? "desc" : "asc";
        newItems = activeItems.map((it, idx) =>
          idx === existingIndex ? { ...it, direction: toggledDir } : it
        );
      } else {
        // 3rd click: "ซ้อนกันก็ให้รีเซ็ต" -> Remove from chain (reset this field)!
        newItems = activeItems.filter((_, idx) => idx !== existingIndex);
      }
    }

    if (newItems.length === 0) {
      if (allowSelectionOrder) {
        onChange("added");
        return;
      }
      newItems = [{ id: "price", direction: "desc" }];
    }

    onChange(itemsToSortString(newItems));
  };

  const handleToggleItemDirection = (fieldId: SortFieldId) => {
    const newItems = activeItems.map((it) =>
      it.id === fieldId ? { ...it, direction: it.direction === "asc" ? ("desc" as const) : ("asc" as const) } : it
    );
    onChange(itemsToSortString(newItems));
  };

  const handleRemoveItem = (fieldId: SortFieldId) => {
    const newItems = activeItems.filter((it) => it.id !== fieldId);
    if (newItems.length === 0) {
      if (allowSelectionOrder) {
        onChange("added");
        return;
      }
      onChange("price_desc");
      return;
    }
    onChange(itemsToSortString(newItems));
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeItems.length) return;
    const copy = [...activeItems];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onChange(itemsToSortString(copy));
  };

  const handleResetClick = () => {
    if (onReset) {
      onReset();
    } else {
      onChange(allowSelectionOrder ? "added" : "price_desc");
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-200">{title}</label>
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          {activeItems.length > 1 && (
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono font-bold px-1.5 py-0.2 rounded-full border border-amber-400/30">
              {activeItems.length} chained
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleResetClick}
          className="text-[11px] text-slate-400 hover:text-amber-400 transition flex items-center gap-1 cursor-pointer font-medium"
          title="Reset sort to default"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Active Sort Chain Display */}
      {isSelectionOrder ? (
        <div className="p-2 rounded-xl bg-[#090b12] border border-white/[0.08] text-xs text-slate-400 flex items-center justify-between">
          <span className="font-medium text-slate-300">As Added (Selection Order)</span>
          <span className="text-[10px] text-slate-500 font-mono">Original</span>
        </div>
      ) : (
        <div className="space-y-1.5 p-2 rounded-xl bg-[#090b12] border border-white/[0.08]">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center justify-between">
            <span>Active Sort Chain</span>
            <span className="text-slate-600 font-mono">1st → 2nd → 3rd</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {activeItems.map((item, idx) => {
              const config = SORT_FIELD_CONFIG[item.id];
              return (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-semibold shadow-sm"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-slate-100">{config.shortLabel}:</span>

                  {/* Toggle Direction Pill */}
                  <button
                    type="button"
                    onClick={() => handleToggleItemDirection(item.id)}
                    className="flex items-center gap-0.5 text-amber-300 hover:text-white bg-amber-400/20 hover:bg-amber-400/30 px-1.5 py-0.5 rounded transition cursor-pointer text-[10px] font-mono font-medium"
                    title="Click to toggle order direction"
                  >
                    <span>{item.direction === "asc" ? config.ascLabel : config.descLabel}</span>
                    {item.direction === "asc" ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5" />
                    )}
                  </button>

                  {/* Move Left / Right if multi */}
                  {activeItems.length > 1 && (
                    <div className="flex items-center gap-0.5 ml-0.5 border-l border-amber-400/30 pl-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, -1)}
                          className="hover:text-white p-0.5 text-slate-400 text-[10px] leading-none"
                          title="Move priority left"
                        >
                          ◀
                        </button>
                      )}
                      {idx < activeItems.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, 1)}
                          className="hover:text-white p-0.5 text-slate-400 text-[10px] leading-none"
                          title="Move priority right"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  )}

                  {/* Remove / Reset single criterion */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-amber-400/70 hover:text-rose-400 p-0.5 rounded transition cursor-pointer ml-0.5"
                    title={`Remove ${config.label} from sort`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clickable Quick Buttons for 4 Fields */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        {(["color", "price", "number", "name"] as const).map((fieldId) => {
          const config = SORT_FIELD_CONFIG[fieldId];
          const activeIndex = activeItems.findIndex((it) => it.id === fieldId);
          const isActive = !isSelectionOrder && activeIndex !== -1;
          const currentItem = isActive ? activeItems[activeIndex] : null;

          return (
            <button
              key={fieldId}
              type="button"
              onClick={() => handleToggleField(fieldId)}
              className={`flex items-center justify-between p-2 rounded-xl border text-xs text-left transition active:scale-[0.98] cursor-pointer ${
                isActive
                  ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold shadow-sm shadow-amber-500/10"
                  : "bg-[#0b0d14] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.18]"
              }`}
              title={
                isActive
                  ? `Priority #${activeIndex + 1}: ${config.label} (${currentItem?.direction === "asc" ? config.ascLabel : config.descLabel}). Click to change direction or remove.`
                  : `Click to add ${config.label} to sort priority`
              }
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isActive ? (
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center shrink-0 font-mono">
                    {activeIndex + 1}
                  </span>
                ) : (
                  <Plus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className="truncate">{config.shortLabel}</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10px] opacity-85 shrink-0 font-mono">
                {isActive ? (
                  <>
                    <span>{currentItem?.direction === "asc" ? config.ascLabel : config.descLabel}</span>
                    {currentItem?.direction === "asc" ? (
                      <ArrowUp className="w-2.5 h-2.5 text-amber-400" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5 text-amber-400" />
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">{config.defaultDir === "asc" ? config.ascLabel : config.descLabel}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {allowSelectionOrder && (
        <button
          type="button"
          onClick={() => onChange("added")}
          className={`w-full py-1.5 px-2 rounded-lg border text-xs text-center transition cursor-pointer ${
            isSelectionOrder
              ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
              : "bg-[#0b0d14] border-white/[0.08] text-slate-400 hover:text-slate-200"
          }`}
        >
          Reset to Selection Order (As Added)
        </button>
      )}

      {/* Helpful Hint */}
      <div className="text-[10px] text-slate-500 leading-tight">
        Tip: Click a field to add • Click again to toggle order • Click to remove / reset
      </div>
    </div>
  );
}

// Searchable Edition Dropdown / Combobox
function SearchableEditionSelect({
  editions,
  selectedEdition,
  onChange,
}: {
  editions: EditionSummary[];
  selectedEdition: string;
  onChange: (edition: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filtered list based on search term (supports both set name and set code like "clb", "mh3", "blb")
  const term = searchTerm.toLowerCase().trim();
  const filteredEditions = editions.filter((ed) => {
    if (!term) return true;
    const matchName = ed.name.toLowerCase().includes(term);
    const matchCode = ed.code ? ed.code.toLowerCase().includes(term) : false;
    return matchName || matchCode;
  });

  const currentEditionObj = editions.find((e) => e.name === selectedEdition);
  const displayLabel =
    selectedEdition === "all"
      ? `All Editions (${editions.length})`
      : currentEditionObj
      ? `${currentEditionObj.code ? `[${currentEditionObj.code}] ` : ""}${currentEditionObj.name} (${currentEditionObj.count})`
      : selectedEdition;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={displayLabel}
        className="w-full flex items-center justify-between bg-[#0b0d14] border border-white/[0.08] hover:border-white/[0.16] rounded-lg px-3 py-2 text-xs text-slate-200 transition outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/25"
      >
        <span className="truncate pr-2 font-medium" title={displayLabel}>{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedEdition !== "all" && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("all");
                setIsOpen(false);
              }}
              className="hover:text-amber-400 p-0.5 rounded text-slate-400 transition-colors"
              title="Reset to All Editions"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-amber-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover with Search Input */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#12141f] border border-white/[0.12] rounded-xl shadow-2xl p-2 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-amber-400/80 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search set name or code (e.g. CLB, MH3)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full bg-[#0b0d14] border border-white/[0.08] rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/25"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List of sets */}
          <div className="max-h-72 overflow-y-auto space-y-0.5 pr-1">
            {/* All Editions option */}
            {(!term || "all editions".includes(term)) && (
              <button
                type="button"
                title={`All Editions (${editions.length} sets)`}
                onClick={() => {
                  onChange("all");
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition text-left ${
                  selectedEdition === "all"
                    ? "bg-amber-400/10 text-amber-300 font-semibold border border-amber-400/30"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="font-medium">All Editions</span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.04]">
                  {editions.length} sets
                </span>
              </button>
            )}

            {filteredEditions.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-500">
                No sets matching &quot;{searchTerm}&quot;
              </div>
            )}

            {filteredEditions.map((ed) => (
              <button
                key={ed.name}
                type="button"
                title={`${ed.name}${ed.code ? ` [${ed.code}]` : ""} (${ed.count.toLocaleString()} cards)`}
                onClick={() => {
                  onChange(ed.name);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left group ${
                  selectedEdition === ed.name
                    ? "bg-amber-400/10 text-amber-300 font-semibold border border-amber-400/30"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                  {ed.code && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/25 shrink-0 uppercase tracking-wider">
                      {ed.code}
                    </span>
                  )}
                  <span className="leading-snug break-words text-slate-200 group-hover:text-white truncate">
                    {ed.name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.04]">
                  {ed.count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Dual-Range Slider Component for Price Filtering with exact Min/Max inputs
function PriceRangeSlider({
  minVal,
  maxVal,
  onChange,
  onReset,
}: {
  minVal: number;
  maxVal: number;
  onChange: (min: number, max: number) => void;
  onReset: () => void;
}) {
  // Local string inputs for smooth typing without cursor jumping
  const [inputMin, setInputMin] = useState(minVal > 0 ? String(minVal) : "");
  const [inputMax, setInputMax] = useState(maxVal < 100 ? String(maxVal) : "");

  // Keep inputs synced when minVal / maxVal change externally (e.g. on reset or slider drag)
  useEffect(() => {
    setInputMin(minVal > 0 ? String(minVal) : "");
  }, [minVal]);

  useEffect(() => {
    setInputMax(maxVal < 100 ? String(maxVal) : "");
  }, [maxVal]);

  // Clamp slider percent to 0-100%
  const sliderMin = Math.min(100, Math.max(0, minVal));
  const sliderMax = Math.min(100, Math.max(0, maxVal));
  const minPercent = (sliderMin / 100) * 100;
  const maxPercent = (sliderMax / 100) * 100;

  const isFiltered = minVal > 0 || maxVal < 100;
  let labelText = "All Prices";
  if (minVal === 0 && maxVal < 100) {
    labelText = `Under $${maxVal}`;
  } else if (minVal > 0 && maxVal >= 100) {
    labelText = `$${minVal}+`;
  } else if (minVal > 0 && maxVal < 100) {
    labelText = `$${minVal} — $${maxVal}`;
  }

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputMin(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed, maxVal);
    } else if (valStr === "") {
      onChange(0, maxVal);
    }
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputMax(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(minVal, parsed);
    } else if (valStr === "") {
      onChange(minVal, 100);
    }
  };

  return (
    <div className="space-y-2 border-b border-white/[0.06] pb-3.5">
      {/* Header with Title and Current Price Range Badge */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-200">Price Range</label>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md transition ${
              isFiltered
                ? "bg-amber-400/10 text-amber-300 font-semibold border border-amber-400/30"
                : "bg-white/[0.04] text-slate-400 border border-white/[0.06]"
            }`}
          >
            {labelText}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setInputMin("");
                setInputMax("");
                onReset();
              }}
              className="text-[10px] text-slate-400 hover:text-amber-400 transition"
              title="Reset price"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Dual Slider Container */}
      <div className="relative pt-3 pb-1 px-0.5">
        {/* Track Background */}
        <div className="h-1.5 w-full bg-[#1b1e2c] rounded-full relative">
          {/* Active Highlight Range Bar */}
          <div
            className="absolute h-full bg-amber-500 rounded-full shadow-sm"
            style={{
              left: `${minPercent}%`,
              width: `${Math.max(0, maxPercent - minPercent)}%`,
            }}
          />
        </div>

        {/* Min Range Input */}
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={sliderMin}
          onChange={(e) => {
            const val = Math.min(Number(e.target.value), sliderMax - 1);
            onChange(val, maxVal);
          }}
          className="dual-slider-thumb"
          style={{ zIndex: sliderMin > 85 ? 5 : 3 }}
        />

        {/* Max Range Input */}
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={sliderMax}
          onChange={(e) => {
            const val = Math.max(Number(e.target.value), sliderMin + 1);
            onChange(minVal, val);
          }}
          className="dual-slider-thumb"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Ticks and Markers */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono tabular-nums px-0.5 select-none">
        <span>$0</span>
        <span>$25</span>
        <span>$50</span>
        <span>$75</span>
        <span>$100+</span>
      </div>

      {/* Manual Min/Max input fields to specify exact range */}
      <div className="flex items-center gap-2 pt-1.5">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-400/80 font-mono font-medium">$</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Min"
            value={inputMin}
            onChange={handleMinInputChange}
            className="w-full bg-[#0b0d14] border border-white/[0.08] rounded-lg pl-6 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/25 transition font-mono tabular-nums text-center"
          />
        </div>
        <span className="text-slate-500 text-xs font-medium select-none">to</span>
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-400/80 font-mono font-medium">$</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Max"
            value={inputMax}
            onChange={handleMaxInputChange}
            className="w-full bg-[#0b0d14] border border-white/[0.08] rounded-lg pl-6 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/25 transition font-mono tabular-nums text-center"
          />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [totalCatalogCards, setTotalCatalogCards] = useState<number>(0);
  const [metaInfo, setMetaInfo] = useState<{ created_at: string; base_url: string }>({
    created_at: "",
    base_url: "https://www.cardkingdom.com/",
  });

  // Filter & Search states (Left Sidebar)
  const [selectedEdition, setSelectedEdition] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [foilFilter, setFoilFilter] = useState<"all" | "foil" | "nonfoil">("all");
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("price_desc");
  const [rowsPerPage, setRowsPerPage] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Toggle multi-select rarity
  const toggleRarity = (r: string) => {
    setCurrentPage(1);
    setSelectedRarities((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    );
  };

  // Cards data
  const [cards, setCards] = useState<CKCard[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Card Selection & Print Studio states
  const [selectedCards, setSelectedCards] = useState<Record<string, { card: CKCard; quantity: number }>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printScale, setPrintScale] = useState<number>(100);
  const [paperSize, setPaperSize] = useState<"a4" | "letter">("a4");
  const [cardGapMm, setCardGapMm] = useState<number>(0);
  const [cuttingGuide, setCuttingGuide] = useState<"hairline" | "dashed" | "none">("hairline");
  const [gridCols, setGridCols] = useState<number>(3);
  const [gridRows, setGridRows] = useState<number>(3);
  const [showPriceOnPrint, setShowPriceOnPrint] = useState<boolean>(true);
  const [priceTagFormat, setPriceTagFormat] = useState<"price_only" | "name_price">("price_only");
  const [printSort, setPrintSort] = useState<string>("added");

  const totalPrintCardCount = Object.values(selectedCards).reduce((acc, c) => acc + c.quantity, 0);

  const toggleCardSelect = useCallback((card: CKCard) => {
    const key = `${card.id}-${card.sku}`;
    setSelectedCards((prev) => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key];
      } else {
        copy[key] = { card, quantity: 1 };
      }
      return copy;
    });
  }, []);

  const updateCardQuantity = useCallback((card: CKCard, delta: number) => {
    const key = `${card.id}-${card.sku}`;
    setSelectedCards((prev) => {
      const copy = { ...prev };
      const current = copy[key]?.quantity || 0;
      const next = current + delta;
      if (next <= 0) {
        delete copy[key];
      } else {
        copy[key] = { card, quantity: Math.min(next, 99) };
      }
      return copy;
    });
  }, []);

  const removeCardFromPrint = useCallback((key: string) => {
    setSelectedCards((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const clearAllSelectedCards = useCallback(() => {
    setSelectedCards({});
  }, []);

  // Search debounce
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Price Range Slider state (0 to 100 where 100 means $100+) & debounce
  const [sliderMin, setSliderMin] = useState<number>(0);
  const [sliderMax, setSliderMax] = useState<number>(100);
  const [debouncedMin, setDebouncedMin] = useState<number>(0);
  const [debouncedMax, setDebouncedMax] = useState<number>(100);

  // Active filter count for mobile badge
  const activeFilterCount =
    (selectedEdition !== "all" ? 1 : 0) +
    (foilFilter !== "all" ? 1 : 0) +
    selectedRarities.length +
    (sliderMin > 0 || sliderMax < 100 ? 1 : 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMin(sliderMin);
      setDebouncedMax(sliderMax);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [sliderMin, sliderMax]);

  // Load editions list
  const loadEditions = useCallback(async () => {
    try {
      const res = await fetch("/api/editions");
      if (res.ok) {
        const data = await res.json();
        setEditions(data.editions || []);
        setTotalCatalogCards(data.totalCards || 0);
        if (data.meta) setMetaInfo(data.meta);
      }
    } catch (e) {
      console.error("Failed to fetch editions:", e);
    }
  }, []);

  useEffect(() => {
    loadEditions();
  }, [loadEditions]);

  // Unregister legacy Service Workers to let the browser handle Scryfall caching natively via HTTP disk cache
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    }
  }, []);

  // AbortController ref to cancel stale filter/search requests in-flight
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Moxfield-style Client-Side Query Cache for instant 0.00s page changes
  const queryCacheRef = useRef<
    Map<
      string,
      {
        cards: CKCard[];
        total: number;
        totalPages: number;
        meta?: { created_at: string; base_url: string };
        timestamp: number;
      }
    >
  >(new Map());

  // Fetch cards whenever filters change (with 0ms instant cache lookup)
  const fetchCards = useCallback(
    async () => {
      const rarityParam = selectedRarities.length === 0 ? "all" : selectedRarities.join(",");
      const minPriceQuery = debouncedMin > 0 ? String(debouncedMin) : "";
      const maxPriceQuery = debouncedMax < 100 ? String(debouncedMax) : "";
      const cacheKey = `${selectedEdition}|${debouncedQuery}|${foilFilter}|${rarityParam}|${minPriceQuery}|${maxPriceQuery}|${sortBy}|${currentPage}|${rowsPerPage}`;

      // Check cache first (0ms instant response)
      const cached = queryCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setCards(cached.cards);
        setTotalCount(cached.total);
        setTotalPages(cached.totalPages);
        if (cached.meta) setMetaInfo(cached.meta);
        setIsLoading(false);
        return;
      }

      // Abort previous in-flight request if user rapidly adjusted filters
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          edition: selectedEdition,
          search: debouncedQuery,
          foil: foilFilter,
          rarity: rarityParam,
          sortBy: sortBy,
          page: String(currentPage),
          limit: String(rowsPerPage),
        });
        if (minPriceQuery) params.set("minPrice", minPriceQuery);
        if (maxPriceQuery) params.set("maxPrice", maxPriceQuery);

        const res = await fetch(`/api/cards?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const cardsList = data.cards || [];
          const totalNum = data.total || 0;
          const pagesNum = data.totalPages || 1;

          setCards(cardsList);
          setTotalCount(totalNum);
          setTotalPages(pagesNum);
          if (data.meta) setMetaInfo(data.meta);

          // Save to client cache
          queryCacheRef.current.set(cacheKey, {
            cards: cardsList,
            total: totalNum,
            totalPages: pagesNum,
            meta: data.meta,
            timestamp: Date.now(),
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Stale request superseded, ignore quietly
        }
        console.error("Error loading cards:", err);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [selectedEdition, debouncedQuery, foilFilter, selectedRarities, debouncedMin, debouncedMax, sortBy, currentPage, rowsPerPage]
  );

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Archidekt-style Background Prefetching for the next page (JSON metadata only)
  useEffect(() => {
    if (isLoading || cards.length === 0 || currentPage >= totalPages) return;

    const prefetchTimer = setTimeout(() => {
      const nextPage = currentPage + 1;
      const rarityParam = selectedRarities.length === 0 ? "all" : selectedRarities.join(",");
      const minPriceQuery = debouncedMin > 0 ? String(debouncedMin) : "";
      const maxPriceQuery = debouncedMax < 100 ? String(debouncedMax) : "";
      const nextKey = `${selectedEdition}|${debouncedQuery}|${foilFilter}|${rarityParam}|${minPriceQuery}|${maxPriceQuery}|${sortBy}|${nextPage}|${rowsPerPage}`;

      if (!queryCacheRef.current.has(nextKey)) {
        const params = new URLSearchParams({
          edition: selectedEdition,
          search: debouncedQuery,
          foil: foilFilter,
          rarity: rarityParam,
          sortBy: sortBy,
          page: String(nextPage),
          limit: String(rowsPerPage),
        });
        if (minPriceQuery) params.set("minPrice", minPriceQuery);
        if (maxPriceQuery) params.set("maxPrice", maxPriceQuery);

        fetch(`/api/cards?${params.toString()}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.cards && data.cards.length > 0) {
              queryCacheRef.current.set(nextKey, {
                cards: data.cards,
                total: data.total || 0,
                totalPages: data.totalPages || 1,
                meta: data.meta,
                timestamp: Date.now(),
              });
            }
          })
          .catch(() => {});
      }
    }, 1500);

    return () => clearTimeout(prefetchTimer);
  }, [currentPage, totalPages, isLoading, cards.length, selectedEdition, debouncedQuery, foilFilter, selectedRarities, debouncedMin, debouncedMax, sortBy, rowsPerPage]);

  // Auto-sync data in the background every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      queryCacheRef.current.clear(); // Invalidate stale cache
      fetchCards();
      loadEditions();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCards, loadEditions]);

  const handleClearForm = () => {
    setSearchQuery("");
    setSelectedEdition("all");
    setFoilFilter("all");
    setSelectedRarities([]);
    setSliderMin(0);
    setSliderMax(100);
    setDebouncedMin(0);
    setDebouncedMax(100);
    setSortBy("price_desc");
    setCurrentPage(1);
    setMobileFilterOpen(false);
  };

  // Hide navbar on scroll down, show on scroll up (optimized with requestAnimationFrame for 60/120fps)
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const lastScrollYRef = useRef<number>(0);
  const tickingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > 60) {
            if (currentScrollY > lastScrollYRef.current + 10) {
              setShowHeader((prev) => (prev ? false : prev));
            } else if (currentScrollY < lastScrollYRef.current - 10) {
              setShowHeader((prev) => (!prev ? true : prev));
            }
          } else {
            setShowHeader((prev) => (!prev ? true : prev));
          }
          lastScrollYRef.current = currentScrollY;
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to top whenever page, edition, or filters change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    setShowHeader(true);
  }, [
    currentPage,
    selectedEdition,
    debouncedQuery,
    foilFilter,
    selectedRarities,
    debouncedMin,
    debouncedMax,
    sortBy,
    rowsPerPage,
  ]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 selection:bg-amber-400/20 selection:text-amber-200">
      <div className="flex flex-col min-h-screen no-print">
        
        {/* Top Navbar - Glassmorphic, crisp and understated */}
        <header
          className={`sticky top-0 z-40 backdrop-blur-xl bg-[#0b0d14]/85 border-b border-white/[0.06] transition-transform duration-300 ${
            showHeader ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Uncle Ji Hand-Drawn Shop Logo */}
              <div className="relative group cursor-pointer">
                <img
                  src="/logo.jpg"
                  alt="LungJi Logo"
                  className="w-9 h-9 rounded-full object-cover border border-amber-400/50 ring-1 ring-white/10 shadow-sm transition-transform"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0b0d14] rounded-full" title="Online & Ready" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white">
                  LungJi
                </span>
                <span className="text-xs sm:text-sm font-bold tracking-tight text-amber-400">
                  Card Shop
                </span>
              </div>
            </div>

            {/* Top Right: Print Studio Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 shadow-md cursor-pointer ${
                  totalPrintCardCount > 0
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/40"
                    : "bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]"
                }`}
                title="Open Card Print Studio"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print Cards</span>
                <span className="sm:hidden">Print</span>
                {totalPrintCardCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[11px] font-bold font-mono">
                    {totalPrintCardCount}
                  </span>
                )}
              </button>
            </div>

          </div>
        </header>


        {/* Main Content Area - Utilizes the wide screen: Sidebar on left space, cards on right */}
        <main className="flex-1 max-w-[1850px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          {/* Mobile / Tablet Filter Bar (Hidden on lg+ Desktop) */}
          <div className="lg:hidden w-full flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search card name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#11131c] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileFilterOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition shrink-0 cursor-pointer ${
                mobileFilterOpen || activeFilterCount > 0
                  ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
                  : "bg-[#11131c] border-white/[0.08] text-slate-300 hover:border-white/[0.16]"
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  mobileFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* LEFT SIDEBAR FILTER - Clean surface, precise groupings */}
            <aside
              className={`w-full lg:w-64 xl:w-72 shrink-0 bg-[#11131c] border border-white/[0.06] rounded-2xl p-4 shadow-xl shadow-black/20 lg:sticky z-30 transition-all duration-300 space-y-4 ${
                showHeader ? "lg:top-18" : "lg:top-4"
              } ${mobileFilterOpen ? "block" : "hidden lg:block"}`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-100 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 text-amber-400" />
                  <span>Filters</span>
                </div>
                {(searchQuery || selectedEdition !== "all" || foilFilter !== "all" || selectedRarities.length > 0 || sliderMin > 0 || sliderMax < 100) && (
                  <button
                    onClick={handleClearForm}
                    className="text-[10px] font-medium text-slate-400 hover:text-amber-400 transition"
                  >
                    Reset all
                  </button>
                )}
              </div>

              {/* Card Name Filter */}
              <div className="space-y-1.5 border-b border-white/[0.06] pb-3.5">
                <label className="text-xs font-semibold text-slate-200">Card Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search card name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0b0d14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/25 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Edition Filter (Searchable) */}
              <div className="space-y-1.5 border-b border-white/[0.06] pb-3.5">
                <label className="text-xs font-semibold text-slate-200">Edition</label>
                <SearchableEditionSelect
                  editions={editions}
                  selectedEdition={selectedEdition}
                  onChange={(ed) => {
                    setSelectedEdition(ed);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Rarity Filter (Multi-select) */}
              <div className="space-y-1.5 border-b border-white/[0.06] pb-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">Rarity</label>
                  {selectedRarities.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedRarities([]);
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-slate-400 hover:text-amber-400 transition"
                      title="Reset rarity"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1 bg-[#0b0d14] p-1 rounded-lg border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRarities([]);
                      setCurrentPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition ${
                      selectedRarities.length === 0
                        ? "bg-white/[0.08] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="All Rarities"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRarity("mythic")}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      selectedRarities.includes("mythic")
                        ? "bg-[#c2410c]/20 text-[#fb923c] border border-[#c2410c]/40 ring-1 ring-[#c2410c]/20"
                        : "text-[#fb923c]/70 hover:text-[#fb923c] hover:bg-white/[0.03]"
                    }`}
                    title="Mythic Rare"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRarity("rare")}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      selectedRarities.includes("rare")
                        ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 ring-1 ring-amber-400/20"
                        : "text-amber-400/70 hover:text-amber-300 hover:bg-white/[0.03]"
                    }`}
                    title="Rare"
                  >
                    R
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRarity("uncommon")}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      selectedRarities.includes("uncommon")
                        ? "bg-slate-300/15 text-slate-200 border border-slate-300/30 ring-1 ring-white/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                    }`}
                    title="Uncommon"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRarity("common")}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      selectedRarities.includes("common")
                        ? "bg-slate-700/40 text-slate-300 border border-slate-600/50"
                        : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                    }`}
                    title="Common"
                  >
                    C
                  </button>
                </div>
              </div>

              {/* Foil / Finish Filter */}
              <div className="space-y-1.5 border-b border-white/[0.06] pb-3.5">
                <label className="text-xs font-semibold text-slate-200">Foil / Finish</label>
                <div className="grid grid-cols-3 gap-1 bg-[#0b0d14] p-1 rounded-lg border border-white/[0.06]">
                  <button
                    onClick={() => {
                      setFoilFilter("all");
                      setCurrentPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition ${
                      foilFilter === "all"
                        ? "bg-white/[0.08] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setFoilFilter("nonfoil");
                      setCurrentPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition ${
                      foilFilter === "nonfoil"
                        ? "bg-white/[0.08] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => {
                      setFoilFilter("foil");
                      setCurrentPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition flex items-center justify-center gap-1 ${
                      foilFilter === "foil"
                        ? "bg-amber-400/15 text-amber-300 border border-amber-400/30 font-semibold"
                        : "text-amber-400/70 hover:text-amber-300"
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Foil</span>
                  </button>
                </div>
              </div>

              {/* Dual-Range Price Slider */}
              <PriceRangeSlider
                minVal={sliderMin}
                maxVal={sliderMax}
                onChange={(min, max) => {
                  setSliderMin(min);
                  setSliderMax(max);
                }}
                onReset={() => {
                  setSliderMin(0);
                  setSliderMax(100);
                }}
              />

              {/* Dynamic Multi-Sort Order */}
              <div className="border-b border-white/[0.06] pb-3.5">
                <DynamicMultiSortControl
                  sortBy={sortBy}
                  onChange={(newSort) => {
                    setSortBy(newSort);
                    setCurrentPage(1);
                  }}
                  onReset={() => {
                    setSortBy("price_desc");
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Rows per page */}
              <div className="space-y-1.5 border-b border-white/[0.06] pb-3.5">
                <label className="text-xs font-semibold text-slate-200">Rows per page</label>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#0b0d14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-400/60 cursor-pointer"
                >
                  <option value={24}>24</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    setCurrentPage(1);
                    fetchCards();
                    setMobileFilterOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-sm transition active:scale-[0.98] text-center"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearForm}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition active:scale-[0.98] text-center"
                >
                  Clear
                </button>
              </div>
            </aside>

            {/* RIGHT SIDE: CARDS AREA (Keeps full width and large size!) */}
            <div className="flex-1 min-w-0 space-y-4">
              
              {/* Results count bar & active filters */}
              <div className="bg-[#11131c] border border-white/[0.06] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 shadow-sm flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400">
                    Found <strong className="font-mono tabular-nums text-white font-semibold">{totalCount.toLocaleString()}</strong> cards
                  </span>
                  {selectedEdition !== "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEdition("all");
                        setCurrentPage(1);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-[11px] max-w-[240px] truncate transition group"
                      title="Clear edition filter"
                    >
                      <span className="truncate">{selectedEdition}</span>
                      <X className="w-3 h-3 text-slate-400 group-hover:text-amber-400 shrink-0" />
                    </button>
                  )}
                  {foilFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setFoilFilter("all");
                        setCurrentPage(1);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[11px] transition group"
                      title="Clear foil filter"
                    >
                      <span>{foilFilter === "foil" ? "Foil" : "Normal"}</span>
                      <X className="w-3 h-3 text-amber-400/70 group-hover:text-amber-300 shrink-0" />
                    </button>
                  )}
                  {selectedRarities.length > 0 &&
                    selectedRarities.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRarity(r)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold capitalize transition group ${
                          r === "mythic"
                            ? "bg-[#c2410c]/20 text-[#fb923c] border-[#c2410c]/40"
                            : r === "rare"
                            ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                            : r === "uncommon"
                            ? "bg-slate-300/15 text-slate-200 border-slate-300/30"
                            : "bg-slate-700/40 text-slate-300 border-slate-600/50"
                        }`}
                        title={`Clear ${r} filter`}
                      >
                        <span>{r}</span>
                        <X className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
                      </button>
                    ))}
                  {(sliderMin > 0 || sliderMax < 100) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSliderMin(0);
                        setSliderMax(100);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 font-mono tabular-nums text-[11px] transition group"
                      title="Clear price filter"
                    >
                      <span>${sliderMin}–${sliderMax >= 100 ? "100+" : sliderMax}</span>
                      <X className="w-3 h-3 text-slate-400 group-hover:text-amber-400 shrink-0" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-slate-400 text-xs font-mono tabular-nums">
                    Page <strong className="text-white font-semibold">{currentPage}</strong> of{" "}
                    <strong className="text-slate-300">{totalPages}</strong>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isLoading}
                        title="Previous page"
                        className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 disabled:opacity-25 disabled:pointer-events-none transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || isLoading}
                        title="Next page"
                        className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 disabled:opacity-25 disabled:pointer-events-none transition"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cards Grid - 6 columns preserved with generous space, cards never squished! */}
              <section className="relative">
                {/* Refined top progress line during filtering */}
                {isLoading && cards.length > 0 && (
                  <div className="absolute -top-2 left-0 right-0 h-0.5 bg-amber-400/10 rounded-full overflow-hidden z-20">
                    <div className="h-full bg-amber-400 animate-pulse w-full" />
                  </div>
                )}

                {isLoading && cards.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2">
                        <div className="w-full aspect-[63/88] rounded-[4.75%] bg-[#11131c] ring-1 ring-white/[0.06]" />
                        <div className="h-3.5 bg-white/[0.05] rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : cards.length === 0 ? (
                  <div className="bg-[#11131c] border border-white/[0.06] rounded-2xl p-12 text-center space-y-3">
                    <PackageX className="w-10 h-10 text-slate-600 mx-auto" />
                    <h3 className="text-base font-semibold text-slate-200">No cards match your filter</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Try widening your price range or adjusting search keywords.
                    </p>
                    <button
                      onClick={handleClearForm}
                      className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl shadow-sm transition active:scale-[0.98]"
                    >
                      Reset Filter
                    </button>
                  </div>
                ) : (
                  <div
                    className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-6 transition-opacity duration-200 ${
                      isLoading ? "opacity-60 pointer-events-none" : "opacity-100"
                    }`}
                  >
                    {cards.map((card, index) => {
                      const key = `${card.id}-${card.sku}`;
                      const selectedItem = selectedCards[key];
                      const isSelected = !!selectedItem;
                      const quantity = selectedItem?.quantity || 0;
                      return (
                        <ArchidektCardItem
                          key={key}
                          card={card}
                          index={index}
                          isSelected={isSelected}
                          quantity={quantity}
                          onToggleSelect={() => toggleCardSelect(card)}
                          onUpdateQuantity={(delta) => updateCardQuantity(card, delta)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <section className="flex items-center justify-center gap-2 py-6">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#11131c] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.98]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b0d14] border border-white/[0.06] text-xs font-mono tabular-nums text-slate-400 shadow-inner">
                    <span>Page</span>
                    <span className="font-semibold text-white">{currentPage}</span>
                    <span>/</span>
                    <span>{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isLoading}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#11131c] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.98]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </section>
              )}
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/[0.06] bg-[#0b0d14]/60 py-6 text-center text-xs text-slate-500 space-y-1">
          <p>
            LungJi • Prices from{" "}
            <a
              href="https://www.cardkingdom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
            >
              Card Kingdom
            </a>{" "}
            • Images via{" "}
            <a
              href="https://scryfall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
            >
              Scryfall
            </a>
          </p>
          {metaInfo.created_at && (
            <p className="text-[11px] text-slate-500 font-mono tabular-nums">
              Catalog updated: {metaInfo.created_at}
            </p>
          )}
        </footer>

        {/* Floating mobile print button */}
        {totalPrintCardCount > 0 && !isPrintModalOpen && (
          <div className="fixed bottom-5 right-5 z-40 sm:hidden animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-2xl ring-2 ring-amber-400/50 active:scale-95 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print ({totalPrintCardCount})</span>
            </button>
          </div>
        )}

        {/* MTG Card Print Studio Modal */}
        {isPrintModalOpen && (
          <PrintStudioModal
            selectedCards={selectedCards}
            onClose={() => setIsPrintModalOpen(false)}
            onUpdateQuantity={updateCardQuantity}
            onRemoveCard={removeCardFromPrint}
            onClearAll={clearAllSelectedCards}
            printScale={printScale}
            setPrintScale={setPrintScale}
            paperSize={paperSize}
            setPaperSize={setPaperSize}
            cardGapMm={cardGapMm}
            setCardGapMm={setCardGapMm}
            cuttingGuide={cuttingGuide}
            setCuttingGuide={setCuttingGuide}
            gridCols={gridCols}
            setGridCols={setGridCols}
            gridRows={gridRows}
            setGridRows={setGridRows}
            showPriceOnPrint={showPriceOnPrint}
            setShowPriceOnPrint={setShowPriceOnPrint}
            priceTagFormat={priceTagFormat}
            setPriceTagFormat={setPriceTagFormat}
            printSort={printSort}
            setPrintSort={setPrintSort}
          />
        )}
      </div>

      {/* Dedicated Print Canvas for Paper Output (Hidden on screen, active in @media print) */}
      {totalPrintCardCount > 0 && (
        <PrintCanvas
          selectedCards={selectedCards}
          printScale={printScale}
          paperSize={paperSize}
          cardGapMm={cardGapMm}
          cuttingGuide={cuttingGuide}
          gridCols={gridCols}
          gridRows={gridRows}
          showPriceOnPrint={showPriceOnPrint}
          priceTagFormat={priceTagFormat}
          printSort={printSort}
        />
      )}
    </div>
  );
}

// Clean card name for Scryfall search (e.g. DFCs like "Copy Token // Eldrazi Angel Token")
function getCleanCardName(name: string): string {
  if (name.includes("//")) {
    return name.split("//")[0].trim();
  }
  return name;
}

// Fast direct Scryfall CDN image URL builder with local disk cache fallback
function getCardImageUrl(card: CKCard, size: "small" | "normal" | "large" = "normal"): string {
  if (card.scryfall_id && card.scryfall_id.length >= 2) {
    const id = card.scryfall_id.toLowerCase().trim();
    return `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
  }
  const cleanName = getCleanCardName(card.name);
  return `/api/card-image?name=${encodeURIComponent(cleanName)}&size=${size}`;
}



// Authentic Scryfall-style MTG Card Back vector placeholder (0ms render, 0KB network)
function MTGCardBack({ name, edition }: { name: string; edition?: string }) {
  return (
    <div className="absolute inset-0 mtg-card-back flex flex-col items-center justify-between p-2 overflow-hidden select-none border border-[#3b2a20]/80">
      {/* Outer dual-frame line imitating authentic MTG brown card border */}
      <div className="absolute inset-[3px] rounded-[3.5%] border-2 border-[#5a4433]/70 pointer-events-none" />
      <div className="absolute inset-[6px] rounded-[2.5%] border border-[#3d2b20]/90 pointer-events-none" />

      {/* Top Header: Vintage Magic The Gathering Arch */}
      <div className="mt-1 flex flex-col items-center">
        <span className="text-[9px] font-black tracking-[0.25em] text-[#d4af37] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          MAGIC
        </span>
        <span className="text-[6.5px] font-bold tracking-[0.18em] text-[#a88a50] uppercase -mt-0.5">
          THE GATHERING
        </span>
      </div>

      {/* Center: The Iconic MTG Mana Pentagram (WUBRG) in dark mystical oval */}
      <div className="relative w-20 h-24 my-auto rounded-full bg-radial from-[#38281d] via-[#1c1511] to-[#0d0a08] border border-[#8b6947]/60 flex items-center justify-center shadow-inner">
        {/* Subtle glowing golden ring */}
        <div className="absolute inset-1.5 rounded-full border border-[#d4af37]/25" />

        {/* 5 Mana Color Dots: White, Blue, Black, Red, Green */}
        <svg viewBox="0 0 100 100" className="w-14 h-14 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          {/* White (Sun - Top) */}
          <circle cx="50" cy="22" r="7" fill="#FFFDEB" stroke="#B89F6B" strokeWidth="1.5" />
          {/* Blue (Droplet - Top Right) */}
          <circle cx="76" cy="41" r="7" fill="#0E68AB" stroke="#68B0E8" strokeWidth="1.5" />
          {/* Black (Skull - Bottom Right) */}
          <circle cx="66" cy="74" r="7" fill="#1C1816" stroke="#6E6864" strokeWidth="1.5" />
          {/* Red (Fire - Bottom Left) */}
          <circle cx="34" cy="74" r="7" fill="#D3202A" stroke="#F58B86" strokeWidth="1.5" />
          {/* Green (Tree - Top Left) */}
          <circle cx="24" cy="41" r="7" fill="#00733E" stroke="#52B87F" strokeWidth="1.5" />
          {/* Center mystic sphere */}
          <circle cx="50" cy="50" r="4" fill="#B38A58" opacity="0.6" />
        </svg>
      </div>

      {/* Bottom Footer: Card Name and Edition */}
      <div className="w-full text-center pb-0.5 px-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-2.5 rounded-b">
        <div className="text-[11px] font-bold text-amber-100/90 line-clamp-1 leading-tight tracking-tight drop-shadow-sm">
          {name}
        </div>
        {edition && (
          <div className="text-[9px] text-amber-300/60 font-medium line-clamp-1 mt-0.5">
            {edition}
          </div>
        )}
      </div>
    </div>
  );
}

// Archidekt-style Card Item: Pure Card Image with instant click-to-select and quantity controls
function ArchidektCardItem({
  card,
  index = 0,
  isSelected = false,
  quantity = 0,
  onToggleSelect,
  onUpdateQuantity,
}: {
  card: CKCard;
  index?: number;
  isSelected?: boolean;
  quantity?: number;
  onToggleSelect: () => void;
  onUpdateQuantity: (delta: number) => void;
}) {
  const isFoil = card.is_foil === "true" || card.is_foil === true;
  const nmPrice = parseFloat(card.condition_values?.nm_price || card.price_retail) || 0;

  // The first 18 cards are in the initial viewport: load immediately on mount!
  const isPriority = index < 18;
  const [isInView, setIsInView] = useState(isPriority);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [retryAttempted, setRetryAttempted] = useState(false);

  // Lazy-load off-screen cards using lightweight IntersectionObserver with 300px buffer + fast-scroll debounce
  useEffect(() => {
    if (isPriority) {
      setIsInView(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          scrollTimer = setTimeout(() => {
            setIsInView(true);
            observer.disconnect();
          }, 50);
        } else {
          if (scrollTimer) {
            clearTimeout(scrollTimer);
            scrollTimer = null;
          }
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(el);
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      observer.disconnect();
    };
  }, [isPriority, card.id, card.sku]);

  // High-Resolution crisp image (Scryfall normal: 488x680)
  const currentImgUrl = fallbackUrl || getCardImageUrl(card, "normal");
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync state when card changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setFallbackUrl(null);
    setRetryAttempted(false);
    setIsInView(index < 18);
  }, [card.id, card.sku, card.scryfall_id, index]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [currentImgUrl, isInView]);

  const handleImgError = () => {
    if (card.scryfall_id && !retryAttempted) {
      setRetryAttempted(true);
      setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = `${getCardImageUrl(card, "normal")}#retry`;
        }
      }, 400);
      return;
    }

    if (!fallbackUrl) {
      setFallbackUrl(`/api/card-image?id=${card.scryfall_id || ""}&name=${encodeURIComponent(getCleanCardName(card.name))}&size=normal`);
    } else {
      setHasError(true);
    }
  };

  const rarityTag = card.rarity ? ` [${card.rarity.toUpperCase()}]` : "";
  const fullCardTitle = `${card.name}${rarityTag} — ${card.edition}${card.variation ? ` (${card.variation})` : ""}`;

  return (
    <div
      ref={containerRef}
      className="archidekt-card-container group flex flex-col cursor-pointer select-none"
      title={fullCardTitle}
      onClick={onToggleSelect}
    >
      {/* PURE CARD IMAGE - rounded corners matching real MTG card */}
      <div
        className={`relative w-full aspect-[63/88] rounded-[4.75%] overflow-hidden bg-[#0c0e16] shadow-md transition-all duration-200 ease-out ${
          isSelected
            ? "ring-2 ring-amber-400 shadow-xl shadow-amber-500/30 scale-[1.02]"
            : "ring-1 ring-white/[0.08] group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/70 group-hover:ring-amber-400/50"
        }`}
      >
        {/* Layer 1: Authentic Scryfall-style MTG Card Back placeholder */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <MTGCardBack name={card.name} edition={card.edition} />
        </div>

        {/* Layer 2: High-Performance Native Image */}
        {isInView && !hasError && (
          <img
            ref={imgRef}
            src={currentImgUrl}
            alt={card.name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setIsLoaded(true)}
            onError={handleImgError}
            className="absolute inset-0 w-full h-full object-cover z-10"
          />
        )}

        {/* Fallback No Image */}
        {isInView && hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-800 text-slate-400 text-xs z-10">
            <Boxes className="w-8 h-8 text-slate-600 mb-1" />
            <span>No Image</span>
          </div>
        )}

        {/* Foil Holographic Shimmer Effect */}
        {isFoil && isLoaded && <div className="mtg-foil-effect z-10" />}

        {/* Foil Badge if applicable */}
        {isFoil && (
          <div className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded-md bg-[#090b12]/85 backdrop-blur-sm border border-amber-400/35 text-amber-300 font-mono text-[9px] font-semibold tracking-wider flex items-center gap-1 shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>FOIL</span>
          </div>
        )}

        {/* Selection Badge (Top-Left) */}
        {isSelected && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-bold text-xs shadow-lg ring-1 ring-black/40 animate-in zoom-in-75 duration-150">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span className="font-mono">{quantity}</span>
          </div>
        )}

        {/* Quantity Stepper (Bottom-Right, shown when selected) */}
        {isSelected && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 right-2 z-20 flex items-center bg-[#090b12]/95 backdrop-blur-md border border-amber-400/60 rounded-lg p-0.5 shadow-xl animate-in fade-in duration-150"
          >
            <button
              type="button"
              onClick={() => onUpdateQuantity(-1)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
              title="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-xs font-bold font-mono text-amber-300 select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(1)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
              title="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* DIRECT UNDER-CARD FOOTER */}
      <div className="mt-1.5 flex items-center justify-between px-0.5 text-xs gap-1">
        {/* Card Kingdom Castle Icon, Price & Badges */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <div
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-mono tabular-nums text-xs font-semibold tracking-tight transition-colors shrink-0"
            title="Card Kingdom Near Mint (NM) Price"
          >
            <CardKingdomIcon className="w-3.5 h-2.5 text-amber-400 shrink-0" />
            <span>${formatPrice(nmPrice)}</span>
          </div>

          {/* Collector Number Badge if available */}
          {card.collector_number && card.collector_number < 900000 && (
            <span
              className="text-[10px] font-mono text-slate-400 bg-white/[0.05] border border-white/[0.08] px-1 py-0.5 rounded leading-none shrink-0"
              title={`Collector Number #${card.collector_number}`}
            >
              #{card.collector_number}
            </span>
          )}

          {/* Color Indicator Badge if available */}
          {card.color && (
            <span
              className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded leading-none shrink-0 ${
                card.color === "W"
                  ? "text-amber-100 bg-amber-950/40 border border-amber-300/30"
                  : card.color === "U"
                  ? "text-blue-300 bg-blue-950/40 border border-blue-400/30"
                  : card.color === "B"
                  ? "text-purple-200 bg-purple-950/40 border border-purple-400/30"
                  : card.color === "R"
                  ? "text-red-300 bg-red-950/40 border border-red-400/30"
                  : card.color === "G"
                  ? "text-emerald-300 bg-emerald-950/40 border border-emerald-400/30"
                  : card.color === "M"
                  ? "text-amber-300 bg-amber-500/20 border border-amber-400/40"
                  : card.color === "L"
                  ? "text-orange-200 bg-stone-900 border border-stone-600/40"
                  : "text-slate-400 bg-white/[0.05] border border-white/[0.08]"
              }`}
              title={`Color: ${
                card.color === "W"
                  ? "White"
                  : card.color === "U"
                  ? "Blue"
                  : card.color === "B"
                  ? "Black"
                  : card.color === "R"
                  ? "Red"
                  : card.color === "G"
                  ? "Green"
                  : card.color === "M"
                  ? "Multicolor"
                  : card.color === "L"
                  ? "Land"
                  : "Colorless"
              }`}
            >
              {card.color}
            </span>
          )}
        </div>

        {/* Card Selection Status Indicator / Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 ${
            isSelected
              ? "bg-amber-400/20 text-amber-300 border border-amber-400/50 hover:bg-amber-400/30"
              : "text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]"
          }`}
          title={isSelected ? `Selected (${quantity} copies)` : "Click to select for printing"}
        >
          {isSelected ? (
            <>
              <Check className="w-3 h-3 text-amber-400 stroke-[2.5]" />
              <span>{quantity}x</span>
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 text-slate-400 group-hover:text-amber-400" />
              <span>Select</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ========================================================
// MTG CARD PRINT STUDIO MODAL & SHEET PREVIEW
// ========================================================
function sortCardsList(cards: CKCard[], sortMode: string = "added"): CKCard[] {
  if (!sortMode || sortMode === "added") return cards;
  const items = parseSortStringToItems(sortMode);
  if (items.length === 0) return cards;

  const list = [...cards];
  return list.sort((a, b) => {
    for (const item of items) {
      if (item.id === "color") {
        const cA = a.color_order ?? 7;
        const cB = b.color_order ?? 7;
        if (cA !== cB) return item.direction === "asc" ? cA - cB : cB - cA;
      } else if (item.id === "price") {
        const pA = parseFloat(a.condition_values?.nm_price || a.price_retail) || 0;
        const pB = parseFloat(b.condition_values?.nm_price || b.price_retail) || 0;
        if (pA !== pB) return item.direction === "desc" ? pB - pA : pA - pB;
      } else if (item.id === "number") {
        const nA = a.collector_number ?? 999999;
        const nB = b.collector_number ?? 999999;
        if (nA !== nB) return item.direction === "asc" ? nA - nB : nB - nA;
      } else if (item.id === "name") {
        const cmp = a.name.localeCompare(b.name);
        if (cmp !== 0) return item.direction === "asc" ? cmp : -cmp;
      }
    }
    return a.name.localeCompare(b.name);
  });
}

interface PrintStudioModalProps {
  selectedCards: Record<string, { card: CKCard; quantity: number }>;
  onClose: () => void;
  onUpdateQuantity: (card: CKCard, delta: number) => void;
  onRemoveCard: (key: string) => void;
  onClearAll: () => void;
  printScale: number;
  setPrintScale: (scale: number) => void;
  paperSize: "a4" | "letter";
  setPaperSize: (paper: "a4" | "letter") => void;
  cardGapMm: number;
  setCardGapMm: (gap: number) => void;
  cuttingGuide: "hairline" | "dashed" | "none";
  setCuttingGuide: (guide: "hairline" | "dashed" | "none") => void;
  gridCols: number;
  setGridCols: (cols: number) => void;
  gridRows: number;
  setGridRows: (rows: number) => void;
  showPriceOnPrint: boolean;
  setShowPriceOnPrint: (show: boolean) => void;
  priceTagFormat: "price_only" | "name_price";
  setPriceTagFormat: (fmt: "price_only" | "name_price") => void;
  printSort?: string;
  setPrintSort?: (sort: string) => void;
}

function PrintStudioModal({
  selectedCards,
  onClose,
  onUpdateQuantity,
  onRemoveCard,
  onClearAll,
  printScale,
  setPrintScale,
  paperSize,
  setPaperSize,
  cardGapMm,
  setCardGapMm,
  cuttingGuide,
  setCuttingGuide,
  gridCols,
  setGridCols,
  gridRows,
  setGridRows,
  showPriceOnPrint,
  setShowPriceOnPrint,
  priceTagFormat,
  setPriceTagFormat,
  printSort = "added",
  setPrintSort,
}: PrintStudioModalProps) {
  // Number of cards per sheet based on grid layout
  const cardsPerSheet = gridCols * gridRows;

  // Flatten card list according to quantities
  const printCardsList = useMemo<{ key: string; card: CKCard; quantity: number }[]>(() => {
    const list: { key: string; card: CKCard; quantity: number }[] = [];
    Object.entries(selectedCards).forEach(([key, val]) => {
      if (val.quantity > 0) {
        list.push({ key, card: val.card, quantity: val.quantity });
      }
    });
    return list;
  }, [selectedCards]);

  const flattenedCards = useMemo<CKCard[]>(() => {
    const list: CKCard[] = [];
    printCardsList.forEach(({ card, quantity }: { card: CKCard; quantity: number }) => {
      for (let i = 0; i < quantity; i++) {
        list.push(card);
      }
    });
    return sortCardsList(list, printSort);
  }, [printCardsList, printSort]);

  // Group into sheets based on user's cardsPerSheet selection
  const sheets = useMemo<CKCard[][]>(() => {
    const res: CKCard[][] = [];
    for (let i = 0; i < flattenedCards.length; i += cardsPerSheet) {
      res.push(flattenedCards.slice(i, i + cardsPerSheet));
    }
    return res;
  }, [flattenedCards, cardsPerSheet]);

  const [previewSheetIndex, setPreviewSheetIndex] = useState(0);
  const currentSheetIndex = Math.min(previewSheetIndex, Math.max(0, sheets.length - 1));
  const currentSheetCards = sheets[currentSheetIndex] || [];

  // Scale mode: "autofit" (maximum page fill) vs "standard" (100% MTG card) vs "custom"
  const [scaleMode, setScaleMode] = useState<"autofit" | "standard" | "custom">("autofit");
  const [showFineTune, setShowFineTune] = useState(false);
  const [activeTab, setActiveTab] = useState<"density" | "standard" | "custom">("density");

  // Auto-fit scale calculator - 6mm printer margin for packing as many cards as possible!
  const calculateFitScale = useCallback((cols: number, rows: number, paper: "a4" | "letter", gap: number, withPrice: boolean) => {
    const pW = paper === "a4" ? 210 : 215.9;
    const pH = paper === "a4" ? 297 : 279.4;
    // 6mm safe desktop printer margins (total 12mm)
    const availW = Math.max(10, pW - 12);
    const availH = Math.max(10, pH - 12);
    const priceH = withPrice ? 3.8 : 0;

    const maxCardW = (availW - Math.max(0, cols - 1) * gap) / cols;
    const maxCardH = (availH - Math.max(0, rows - 1) * gap) / rows - priceH;

    const scaleByW = (maxCardW / 63) * 100;
    const scaleByH = (maxCardH / 88) * 100;
    return Math.min(160, Math.max(25, Math.floor(Math.min(scaleByW, scaleByH))));
  }, []);

  const autoFitScale = useMemo(() => {
    return calculateFitScale(gridCols, gridRows, paperSize, cardGapMm, showPriceOnPrint);
  }, [calculateFitScale, gridCols, gridRows, paperSize, cardGapMm, showPriceOnPrint]);

  // Apply auto-scale when layout changes if in autofit mode
  const applyGridLayout = (cols: number, rows: number) => {
    setGridCols(cols);
    setGridRows(rows);
    if (scaleMode === "autofit" || (cols * rows > 9)) {
      setScaleMode("autofit");
      const fit = calculateFitScale(cols, rows, paperSize, cardGapMm, showPriceOnPrint);
      setPrintScale(fit);
    } else if (scaleMode === "standard") {
      setPrintScale(100);
    }
  };

  // Mouse wheel listener on the paper preview container to smoothly flip sheets
  const paperWrapperRef = useRef<HTMLDivElement>(null);
  const lastWheelTimeRef = useRef<number>(0);

  useEffect(() => {
    const el = paperWrapperRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (sheets.length <= 1) return;
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastWheelTimeRef.current < 160) return;

      if (e.deltaY > 8) {
        setPreviewSheetIndex((prev) => {
          if (prev < sheets.length - 1) {
            lastWheelTimeRef.current = now;
            return prev + 1;
          }
          return prev;
        });
      } else if (e.deltaY < -8) {
        setPreviewSheetIndex((prev) => {
          if (prev > 0) {
            lastWheelTimeRef.current = now;
            return prev - 1;
          }
          return prev;
        });
      }
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
    };
  }, [sheets.length]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setPreviewSheetIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setPreviewSheetIndex((prev) => Math.min(sheets.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sheets.length, onClose]);

  // Physical Dimensions
  const cardWidthMm = (63 * printScale) / 100;
  const cardHeightMm = (88 * printScale) / 100;
  const cardWidthIn = (cardWidthMm / 25.4).toFixed(2);
  const cardHeightIn = (cardHeightMm / 25.4).toFixed(2);
  const priceTagMm = showPriceOnPrint ? 3.8 : 0;

  // Paper Dimensions & Margins
  const paperWidthMm = paperSize === "a4" ? 210 : 215.9;
  const paperHeightMm = paperSize === "a4" ? 297 : 279.4;
  const gridWidthMm = gridCols * cardWidthMm + Math.max(0, gridCols - 1) * cardGapMm;
  const gridHeightMm = gridRows * (cardHeightMm + priceTagMm) + Math.max(0, gridRows - 1) * cardGapMm;
  const hMarginMm = Math.max(0, (paperWidthMm - gridWidthMm) / 2);
  const vMarginMm = Math.max(0, (paperHeightMm - gridHeightMm) / 2);

  // Trigger browser native print dialog
  const handlePrint = () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 no-print"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl bg-[#11131d] border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#0c0e16]/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Card Print Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[11px] font-mono font-semibold">
                  {flattenedCards.length} {flattenedCards.length === 1 ? "Card" : "Cards"} ({sheets.length} {sheets.length === 1 ? "Sheet" : "Sheets"})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Exact physical millimeter scaling • {gridCols}×{gridRows} ({cardsPerSheet} cards/sheet) {showPriceOnPrint ? "• With Prices" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={flattenedCards.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Now</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
          {/* LEFT SIDE: CONTROLS & SELECTED CARDS QUEUE */}
          <div className="w-full lg:w-[430px] shrink-0 p-4 sm:p-5 space-y-4 overflow-y-auto bg-[#0d0f17]">
            {/* 1. Cards Per Sheet & Auto-Scale Controller */}
            <div className="bg-[#131622] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-bold text-white tracking-wide uppercase">
                    Cards per Sheet (จำนวนการ์ดต่อแผ่น)
                  </label>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-black font-mono text-amber-400 tabular-nums">
                    {cardsPerSheet}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({gridCols}×{gridRows})
                  </span>
                </div>
              </div>

              {/* Layout Category Tabs */}
              <div className="flex items-center p-1 bg-[#090b12] rounded-xl border border-white/[0.06] gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("density")}
                  className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    activeTab === "density"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>High Density (เยอะสุด)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("standard")}
                  className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    activeTab === "standard"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Standard (ปกติ)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("custom")}
                  className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    activeTab === "custom"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Custom (กำหนดเอง)</span>
                </button>
              </div>

              {/* TAB A: High Density Presets (42, 30, 25, 20, 16 cards) */}
              {activeTab === "density" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { count: 30, cols: 5, rows: 6, label: "30 Cards", sub: "5×6 Pocket (~53%)" },
                      { count: 25, cols: 5, rows: 5, label: "25 Cards", sub: "5×5 Catalog (~58%)" },
                      { count: 20, cols: 4, rows: 5, label: "20 Cards", sub: "4×5 Compact (~64%)" },
                      { count: 16, cols: 4, rows: 4, label: "16 Cards", sub: "4×4 Mini (~74%)" },
                      { count: 42, cols: 6, rows: 7, label: "42 Cards", sub: "6×7 Ultra (~43%)" },
                      { count: 56, cols: 7, rows: 8, label: "56 Cards", sub: "7×8 Mega (~37%)" },
                    ].map((preset) => {
                      const isActive = gridCols === preset.cols && gridRows === preset.rows;
                      return (
                        <button
                          key={preset.count}
                          type="button"
                          onClick={() => applyGridLayout(preset.cols, preset.rows)}
                          className={`py-2 px-1 rounded-xl text-center transition cursor-pointer border ${
                            isActive
                              ? "bg-amber-400/20 border-amber-400/80 text-amber-300 font-bold shadow-md ring-1 ring-amber-400/40"
                              : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="text-xs font-mono font-bold">{preset.label}</div>
                          <div className="text-[9px] opacity-75 mt-0.5 truncate">{preset.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB B: Standard MTG Presets (9, 6, 4, 2, 1 cards) */}
              {activeTab === "standard" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { count: 9, cols: 3, rows: 3, label: "9 Cards", sub: "3×3 (100%)" },
                      { count: 6, cols: 2, rows: 3, label: "6 Cards", sub: "2×3 Spacious" },
                      { count: 4, cols: 2, rows: 2, label: "4 Cards", sub: "2×2 Large" },
                      { count: 1, cols: 1, rows: 1, label: "1 Card", sub: "Showcase" },
                    ].map((preset) => {
                      const isActive = gridCols === preset.cols && gridRows === preset.rows;
                      return (
                        <button
                          key={preset.count}
                          type="button"
                          onClick={() => applyGridLayout(preset.cols, preset.rows)}
                          className={`py-2 px-1 rounded-xl text-center transition cursor-pointer border ${
                            isActive
                              ? "bg-amber-400/20 border-amber-400/80 text-amber-300 font-bold shadow-md ring-1 ring-amber-400/40"
                              : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="text-xs font-mono font-bold">{preset.label}</div>
                          <div className="text-[9px] opacity-75 mt-0.5">{preset.sub}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* MTG Standard 100% vs Auto-Fit Page Toggle */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setScaleMode("standard");
                        setPrintScale(100);
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                        scaleMode === "standard"
                          ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                          : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-medium">Standard MTG (100%)</div>
                      <div className="text-[10px] text-slate-500 font-mono">63 × 88 mm (Sleeve Size)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScaleMode("autofit");
                        const fit = calculateFitScale(gridCols, gridRows, paperSize, cardGapMm, showPriceOnPrint);
                        setPrintScale(fit);
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                        scaleMode === "autofit"
                          ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                          : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-medium">Fit to Page (Auto)</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Auto-scale: {autoFitScale}%
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB C: Custom Grid Steppers */}
              {activeTab === "custom" && (
                <div className="p-3 rounded-xl bg-[#090b12] border border-white/[0.06] space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Columns (คอลัมน์)</span>
                      <div className="flex items-center gap-1.5 bg-[#131622] border border-white/10 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => applyGridLayout(Math.max(1, gridCols - 1), gridRows)}
                          className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-center font-mono font-bold text-amber-300">
                          {gridCols}
                        </span>
                        <button
                          type="button"
                          onClick={() => applyGridLayout(Math.min(8, gridCols + 1), gridRows)}
                          className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Rows (แถว)</span>
                      <div className="flex items-center gap-1.5 bg-[#131622] border border-white/10 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => applyGridLayout(gridCols, Math.max(1, gridRows - 1))}
                          className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-center font-mono font-bold text-amber-300">
                          {gridRows}
                        </span>
                        <button
                          type="button"
                          onClick={() => applyGridLayout(gridCols, Math.min(10, gridRows + 1))}
                          className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-300/80 font-mono text-center">
                    Total: {cardsPerSheet} cards/sheet • Auto-scale: {autoFitScale}%
                  </div>
                </div>
              )}

              {/* Exact Physical Dimensions Readout */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#090b12] border border-white/[0.04] text-center font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Millimeters</div>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">
                    {cardWidthMm.toFixed(1)} × {cardHeightMm.toFixed(1)} mm
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Inches & Scale</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5">
                    {cardWidthIn}&quot; × {cardHeightIn}&quot; ({printScale}%)
                  </div>
                </div>
              </div>

              {/* Optional Manual Fine-tune Collapsible */}
              <div className="pt-1 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowFineTune((prev) => !prev)}
                  className="text-[11px] text-slate-500 hover:text-amber-400 transition cursor-pointer flex items-center justify-between w-full"
                >
                  <span className="flex items-center gap-1">
                    <Settings2 className="w-3 h-3" />
                    <span>Fine-tune scale slider (optional)</span>
                  </span>
                  <span className="flex items-center gap-1 text-[10px]">
                    <span>{showFineTune ? "Hide" : "Show"}</span>
                    {showFineTune ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </span>
                </button>

                {showFineTune && (
                  <div className="mt-2.5 space-y-1.5 animate-in fade-in duration-150">
                    <input
                      type="range"
                      min={25}
                      max={160}
                      step={1}
                      value={printScale}
                      onChange={(e) => {
                        setScaleMode("custom");
                        setPrintScale(Number(e.target.value));
                      }}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>25%</span>
                      <span>100% (Standard)</span>
                      <span>160%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PRICE UNDER CARD TOGGLE (Requested by user!) */}
            <div className="bg-[#131622] border border-amber-400/25 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <span>Show Price under Card</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-mono font-semibold">
                      ใส่ราคาใต้การ์ด
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Displays Card Kingdom NM price below each printed card
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showPriceOnPrint;
                    setShowPriceOnPrint(next);
                    if (scaleMode === "autofit") {
                      const fit = calculateFitScale(gridCols, gridRows, paperSize, cardGapMm, next);
                      setPrintScale(fit);
                    }
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    showPriceOnPrint ? "bg-amber-500" : "bg-slate-700"
                  }`}
                  title="Toggle Price Tag below cards"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      showPriceOnPrint ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Price Tag Format Options */}
              {showPriceOnPrint && (
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/[0.06] text-xs">
                  <button
                    type="button"
                    onClick={() => setPriceTagFormat("price_only")}
                    className={`py-1 px-2 rounded-lg border text-center transition cursor-pointer ${
                      priceTagFormat === "price_only"
                        ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                        : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                    }`}
                  >
                    Price Only ($1.49)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceTagFormat("name_price")}
                    className={`py-1 px-2 rounded-lg border text-center transition cursor-pointer ${
                      priceTagFormat === "name_price"
                        ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                        : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                    }`}
                  >
                    Name + Price
                  </button>
                </div>
              )}
            </div>

            {/* 3. Paper Size & Spacing Options */}
            <div className="bg-[#131622] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Paper & Layout</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Margin: ~{hMarginMm.toFixed(1)}mm H / ~{vMarginMm.toFixed(1)}mm V
                </span>
              </div>

              {/* Paper Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaperSize("a4");
                    if (scaleMode === "autofit") {
                      setPrintScale(calculateFitScale(gridCols, gridRows, "a4", cardGapMm, showPriceOnPrint));
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border text-left transition cursor-pointer ${
                    paperSize === "a4"
                      ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                      : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">A4 Standard</div>
                  <div className="text-[10px] text-slate-500 font-mono">210 × 297 mm</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaperSize("letter");
                    if (scaleMode === "autofit") {
                      setPrintScale(calculateFitScale(gridCols, gridRows, "letter", cardGapMm, showPriceOnPrint));
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border text-left transition cursor-pointer ${
                    paperSize === "letter"
                      ? "bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold"
                      : "bg-[#090b12] border-white/[0.06] text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">US Letter</div>
                  <div className="text-[10px] text-slate-500 font-mono">215.9 × 279.4 mm</div>
                </button>
              </div>

              {/* Card Gap (Spacing) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Cut Gap (Spacing)</span>
                  <span className="text-xs font-mono text-amber-400 font-semibold">{cardGapMm} mm</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "0 mm", sub: "Single Cut", gap: 0 },
                    { label: "0.5 mm", sub: "Tight", gap: 0.5 },
                    { label: "1 mm", sub: "Border", gap: 1 },
                    { label: "2 mm", sub: "Spaced", gap: 2 },
                  ].map((g) => (
                    <button
                      key={g.gap}
                      type="button"
                      onClick={() => {
                        setCardGapMm(g.gap);
                        if (scaleMode === "autofit") {
                          setPrintScale(calculateFitScale(gridCols, gridRows, paperSize, g.gap, showPriceOnPrint));
                        }
                      }}
                      className={`py-1 px-1 rounded-lg text-center transition cursor-pointer border ${
                        cardGapMm === g.gap
                          ? "bg-amber-400/20 border-amber-400/60 text-amber-300 font-bold"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="text-xs font-mono">{g.label}</div>
                      <div className="text-[9px] opacity-75">{g.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cutting Guides */}
              <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
                <span className="text-xs text-slate-300">Cutting Guide Style</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Hairline", guide: "hairline" as const },
                    { label: "Dashed", guide: "dashed" as const },
                    { label: "None", guide: "none" as const },
                  ].map((style) => (
                    <button
                      key={style.guide}
                      type="button"
                      onClick={() => setCuttingGuide(style.guide)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition cursor-pointer border ${
                        cuttingGuide === style.guide
                          ? "bg-amber-400/20 border-amber-400/60 text-amber-300 font-bold"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Card Print Queue */}
            <div className="bg-[#131622] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    Print Queue ({printCardsList.length} Unique)
                  </span>
                </div>
                {printCardsList.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-[11px] text-slate-500 hover:text-rose-400 transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {printCardsList.length > 0 && setPrintSort && (
                <div className="pt-1 pb-1 border-b border-white/[0.06]">
                  <DynamicMultiSortControl
                    sortBy={printSort}
                    onChange={(newSort) => setPrintSort(newSort)}
                    onReset={() => setPrintSort("added")}
                    title="Print Order on Sheets"
                    allowSelectionOrder={true}
                  />
                </div>
              )}

              {printCardsList.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <PackageX className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">No cards selected for printing</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Click any card in the shop catalog to select it and adjust quantities!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {printCardsList.map(({ key, card, quantity }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#090b12] border border-white/[0.04] gap-2.5 group"
                    >
                      {/* Mini Thumbnail */}
                      <div className="w-8 aspect-[63/88] rounded overflow-hidden shrink-0 bg-slate-800 border border-white/10">
                        <img
                          src={getCardImageUrl(card, "small")}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Card Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {card.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span className="truncate">{card.edition}</span>
                          <span>•</span>
                          <span className="text-amber-400">${formatPrice(parseFloat(card.price_retail) || 0)}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(card, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-amber-300">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(card, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveCard(key)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition ml-0.5 cursor-pointer"
                          title="Remove card"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Print Guidance Note */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-200/90 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Printing Best Practice:</span>
              </div>
              <p className="leading-relaxed">
                In your browser&apos;s Print Dialog: Set <strong>Margins to &quot;None&quot;</strong> and <strong>Scale to &quot;100%&quot;</strong> to guarantee 1:1 true physical card dimensions.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE: INTERACTIVE REAL-TIME SHEET PREVIEW */}
          <div className="flex-1 bg-[#07080d] p-4 sm:p-6 flex flex-col items-center justify-between min-h-[500px]">
            {/* Sheet Navigator Header */}
            <div className="w-full flex items-center justify-between pb-3 max-w-[500px]">
              <div className="text-xs text-slate-300 font-medium">
                Sheet Preview: <strong className="text-white">{paperSize.toUpperCase()}</strong> ({sheets.length > 0 ? currentSheetIndex + 1 : 0} of {sheets.length || 1})
              </div>

              {sheets.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewSheetIndex((p) => Math.max(0, p - 1))}
                    disabled={currentSheetIndex === 0}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                    title="Previous sheet (Left Arrow or Wheel Up)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="text-xs font-mono tabular-nums text-slate-400 px-1">
                    {currentSheetIndex + 1} / {sheets.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewSheetIndex((p) => Math.min(sheets.length - 1, p + 1))}
                    disabled={currentSheetIndex >= sheets.length - 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                    title="Next sheet (Right Arrow or Wheel Down)"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* REALISTIC PHYSICAL PAPER SHEET MOCKUP (WITH MOUSE WHEEL PAGE FLIP) */}
            <div
              ref={paperWrapperRef}
              className="w-full flex-1 flex flex-col items-center justify-center py-2 relative group"
              title={sheets.length > 1 ? "Scroll mouse wheel to change sheets" : undefined}
            >
              {/* Floating mouse wheel badge */}
              {sheets.length > 1 && (
                <div className="mb-2 px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[11px] text-amber-300 font-medium flex items-center gap-1.5 shadow-sm">
                  <MousePointer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scroll mouse wheel over paper to change pages ({currentSheetIndex + 1}/{sheets.length})</span>
                </div>
              )}

              <div
                className={`relative bg-white text-slate-900 rounded-sm shadow-2xl shadow-black/80 flex items-center justify-center p-2.5 select-none transition-all duration-200 ${
                  sheets.length > 1 ? "cursor-ns-resize hover:ring-2 hover:ring-amber-400/40" : ""
                }`}
                style={{
                  width: "100%",
                  maxWidth: paperSize === "a4" ? "420px" : "440px",
                  aspectRatio: paperSize === "a4" ? "210 / 297" : "215.9 / 279.4",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
                }}
              >
                {/* Visual Paper Edge Marks */}
                <div className="absolute inset-0 pointer-events-none border border-slate-200/60" />

                {/* Dynamic Card Grid (Cols x Rows) */}
                <div
                  className="grid transition-all duration-200 ease-out"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                    width: `${Math.min(96, (gridWidthMm / paperWidthMm) * 100)}%`,
                    height: `${Math.min(96, (gridHeightMm / paperHeightMm) * 100)}%`,
                    gap: `${Math.max(1, cardGapMm * 1.5)}px`,
                  }}
                >
                  {Array.from({ length: cardsPerSheet }).map((_, slotIdx) => {
                    const card = currentSheetCards[slotIdx];
                    const cardPrice = card ? parseFloat(card.condition_values?.nm_price || card.price_retail) || 0 : 0;
                    return (
                      <div
                        key={slotIdx}
                        className="flex flex-col items-center justify-start overflow-hidden w-full h-full"
                      >
                        <div
                          className={`relative w-full aspect-[63/88] rounded-[2%] overflow-hidden flex items-center justify-center ${
                            card
                              ? cuttingGuide === "hairline"
                                ? "ring-1 ring-black"
                                : cuttingGuide === "dashed"
                                ? "border border-dashed border-slate-400"
                                : "border-none"
                              : "border border-dashed border-slate-300 bg-slate-50/50"
                          }`}
                        >
                          {card ? (
                            <img
                              src={getCardImageUrl(card, "normal")}
                              alt={card.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[7px] font-mono text-slate-400 select-none">
                              {slotIdx + 1}
                            </span>
                          )}
                        </div>

                        {/* Price tag below card image */}
                        {showPriceOnPrint && card && (
                          <div
                            className="w-full text-center font-mono font-bold text-slate-900 leading-tight truncate mt-0.5 select-none"
                            style={{
                              fontSize: `${Math.max(6, Math.min(9, (380 / gridCols) * 0.12))}px`,
                            }}
                          >
                            {priceTagFormat === "name_price" && gridCols <= 4 ? (
                              <span>
                                {getCleanCardName(card.name).slice(0, 7)} <strong className="text-amber-800">${formatPrice(cardPrice)}</strong>
                              </span>
                            ) : (
                              `$${formatPrice(cardPrice)}`
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Subtle paper watermark in bottom corner */}
                <div className="absolute bottom-1 right-2 text-[7px] font-mono text-slate-400 select-none">
                  LungJi • {paperSize.toUpperCase()} • {gridCols}×{gridRows} ({cardsPerSheet}/sheet) • {printScale}%
                </div>
              </div>
            </div>

            {/* Bottom Info Bar in Preview Area */}
            <div className="w-full max-w-[500px] flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06]">
              <span className="font-mono">
                {cardsPerSheet} Cards / Sheet ({gridCols}×{gridRows}) {showPriceOnPrint ? "• With Prices" : ""}
              </span>
              <button
                type="button"
                onClick={handlePrint}
                disabled={flattenedCards.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition active:scale-95 cursor-pointer disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print {sheets.length} {sheets.length === 1 ? "Sheet" : "Sheets"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================================
// PHYSICAL PRINT CANVAS RENDERER FOR NATIVE WINDOW.PRINT()
// ========================================================
interface PrintCanvasProps {
  selectedCards: Record<string, { card: CKCard; quantity: number }>;
  printScale: number;
  paperSize: "a4" | "letter";
  cardGapMm: number;
  cuttingGuide: "hairline" | "dashed" | "none";
  gridCols: number;
  gridRows: number;
  showPriceOnPrint: boolean;
  priceTagFormat: "price_only" | "name_price";
  printSort?: string;
}

function PrintCanvas({
  selectedCards,
  printScale,
  paperSize,
  cardGapMm,
  cuttingGuide,
  gridCols,
  gridRows,
  showPriceOnPrint,
  priceTagFormat,
  printSort = "added",
}: PrintCanvasProps) {
  const cardsPerSheet = gridCols * gridRows;

  const flattenedCards = useMemo<CKCard[]>(() => {
    const list: CKCard[] = [];
    Object.values(selectedCards).forEach(({ card, quantity }: { card: CKCard; quantity: number }) => {
      for (let i = 0; i < quantity; i++) {
        list.push(card);
      }
    });
    return sortCardsList(list, printSort);
  }, [selectedCards, printSort]);

  const sheets = useMemo<CKCard[][]>(() => {
    const res: CKCard[][] = [];
    for (let i = 0; i < flattenedCards.length; i += cardsPerSheet) {
      res.push(flattenedCards.slice(i, i + cardsPerSheet));
    }
    return res;
  }, [flattenedCards, cardsPerSheet]);

  if (sheets.length === 0) return null;

  const cardWidthMm = (63 * printScale) / 100;
  const cardHeightMm = (88 * printScale) / 100;
  const paperWidthMm = paperSize === "a4" ? 210 : 215.9;
  const paperHeightMm = paperSize === "a4" ? 297 : 279.4;
  const priceTagMm = showPriceOnPrint ? 3.8 : 0;

  const borderStyle =
    cuttingGuide === "hairline"
      ? "0.2mm solid #000000"
      : cuttingGuide === "dashed"
      ? "0.2mm dashed #555555"
      : "none";

  return (
    <div id="mtg-print-canvas" aria-hidden="true">
      {sheets.map((sheetCards: CKCard[], sheetIdx: number) => (
        <div
          key={sheetIdx}
          className="print-page-sheet"
          style={{
            width: `${paperWidthMm}mm`,
            height: `${paperHeightMm}mm`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridCols}, ${cardWidthMm}mm)`,
              gridTemplateRows: `repeat(${gridRows}, ${cardHeightMm + priceTagMm}mm)`,
              gap: `${cardGapMm}mm`,
              justifyContent: "center",
              alignContent: "center",
            }}
          >
            {sheetCards.map((card: CKCard, cardIdx: number) => {
              const cardPrice = parseFloat(card.condition_values?.nm_price || card.price_retail) || 0;
              return (
                <div
                  key={`${sheetIdx}-${cardIdx}-${card.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    boxSizing: "border-box",
                    width: `${cardWidthMm}mm`,
                    height: `${cardHeightMm + priceTagMm}mm`,
                  }}
                >
                  <div
                    style={{
                      width: `${cardWidthMm}mm`,
                      height: `${cardHeightMm}mm`,
                      position: "relative",
                      overflow: "hidden",
                      border: borderStyle,
                      boxSizing: "border-box",
                      backgroundColor: "#000000",
                    }}
                  >
                    <img
                      src={getCardImageUrl(card, "large")}
                      alt={card.name}
                      loading="eager"
                      decoding="sync"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  {showPriceOnPrint && (
                    <div
                      style={{
                        width: `${cardWidthMm}mm`,
                        fontSize: `${Math.max(4.5, Math.min(8.5, cardWidthMm * 0.17))}pt`,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        textAlign: "center",
                        lineHeight: 1.15,
                        marginTop: "0.4mm",
                        color: "#000000",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        padding: "0 0.2mm",
                      }}
                    >
                      {priceTagFormat === "name_price" && cardWidthMm >= 32 ? (
                        <>
                          <span style={{ fontWeight: 500 }}>{getCleanCardName(card.name).slice(0, 9)} </span>
                          <span>${formatPrice(cardPrice)}</span>
                        </>
                      ) : (
                        `$${formatPrice(cardPrice)}`
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

