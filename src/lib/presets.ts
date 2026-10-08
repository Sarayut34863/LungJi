export interface FilterPreset {
  id: string;
  name: string;
  createdAt: number;
  rarities: string[];
  colors: string[];
  colorMode: "exact" | "any";
  foil: "all" | "foil" | "nonfoil";
  tokens: "hide" | "show";
  minPrice: number;
  maxPrice: number;
  edition?: string;
  search?: string;
  sortBy?: string;
}

export const BUILTIN_PRESETS: FilterPreset[] = [
  {
    id: "all",
    name: "All Cards",
    createdAt: 0,
    rarities: [],
    colors: [],
    colorMode: "exact",
    foil: "all",
    tokens: "hide",
    minPrice: 0,
    maxPrice: 100,
    edition: "all",
    sortBy: "price_desc",
  },
  {
    id: "high_rares",
    name: "Rare & Mythic",
    createdAt: 0,
    rarities: ["rare", "mythic"],
    colors: [],
    colorMode: "exact",
    foil: "all",
    tokens: "hide",
    minPrice: 0,
    maxPrice: 100,
    edition: "all",
    sortBy: "price_desc",
  },
  {
    id: "multicolor",
    name: "Multicolor",
    createdAt: 0,
    rarities: [],
    colors: ["M"],
    colorMode: "exact",
    foil: "all",
    tokens: "hide",
    minPrice: 0,
    maxPrice: 100,
    edition: "all",
    sortBy: "price_desc",
  },
  {
    id: "foils",
    name: "Foils Only",
    createdAt: 0,
    rarities: [],
    colors: [],
    colorMode: "exact",
    foil: "foil",
    tokens: "hide",
    minPrice: 0,
    maxPrice: 100,
    edition: "all",
    sortBy: "price_desc",
  },
  {
    id: "budget",
    name: "Budget Singles",
    createdAt: 0,
    rarities: [],
    colors: [],
    colorMode: "exact",
    foil: "all",
    tokens: "hide",
    minPrice: 0,
    maxPrice: 2,
    edition: "all",
    sortBy: "price_desc",
  },
];

const STORAGE_KEY = "lungji_filter_presets";

export function getSavedPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePresetToStorage(preset: Omit<FilterPreset, "id" | "createdAt">): FilterPreset {
  const newPreset: FilterPreset = {
    ...preset,
    id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: Date.now(),
  };

  const existing = getSavedPresets();
  const updated = [newPreset, ...existing.filter((p) => p.name.trim().toLowerCase() !== preset.name.trim().toLowerCase())];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return newPreset;
}

export function deletePresetFromStorage(id: string): void {
  const existing = getSavedPresets();
  const updated = existing.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function encodePresetCode(preset: Partial<FilterPreset>): string {
  try {
    const payload = {
      r: preset.rarities || [],
      c: preset.colors || [],
      cm: preset.colorMode || "exact",
      f: preset.foil || "all",
      t: preset.tokens || "hide",
      min: preset.minPrice ?? 0,
      max: preset.maxPrice ?? 100,
      ed: preset.edition && preset.edition !== "all" ? preset.edition : undefined,
      s: preset.sortBy && preset.sortBy !== "price_desc" ? preset.sortBy : undefined,
    };
    const jsonStr = JSON.stringify(payload);
    // Base64 encode safe for UTF-8
    const b64 = typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(jsonStr)))
      : Buffer.from(jsonStr).toString("base64");
    return `LJ-${b64}`;
  } catch (e) {
    console.error("Error encoding preset code:", e);
    return "";
  }
}

export function decodePresetCode(rawCode: string): Partial<FilterPreset> | null {
  try {
    const cleaned = rawCode.trim().replace(/^LJ-/, "");
    if (!cleaned) return null;
    const jsonStr = typeof window !== "undefined"
      ? decodeURIComponent(escape(window.atob(cleaned)))
      : Buffer.from(cleaned, "base64").toString("utf8");
    const parsed = JSON.parse(jsonStr);

    return {
      rarities: Array.isArray(parsed.r) ? parsed.r : [],
      colors: Array.isArray(parsed.c) ? parsed.c : [],
      colorMode: parsed.cm === "any" ? "any" : "exact",
      foil: ["all", "foil", "nonfoil"].includes(parsed.f) ? parsed.f : "all",
      tokens: parsed.t === "show" ? "show" : "hide",
      minPrice: typeof parsed.min === "number" ? parsed.min : 0,
      maxPrice: typeof parsed.max === "number" ? parsed.max : 100,
      edition: parsed.ed || "all",
      sortBy: parsed.s || "price_desc",
    };
  } catch {
    return null;
  }
}

// Synchronize URL silently in the browser address bar (no reload, no UI intrusion)
export function syncFiltersToUrl(filters: {
  rarities?: string[];
  colors?: string[];
  colorMode?: "exact" | "any";
  foil?: "all" | "foil" | "nonfoil";
  tokens?: "hide" | "show";
  minPrice?: number;
  maxPrice?: number;
  edition?: string;
  search?: string;
  sortBy?: string;
}): void {
  if (typeof window === "undefined") return;

  try {
    const params = new URLSearchParams();

    if (filters.search && filters.search.trim()) {
      params.set("q", filters.search.trim());
    }
    if (filters.edition && filters.edition !== "all") {
      params.set("ed", filters.edition);
    }
    if (filters.rarities && filters.rarities.length > 0) {
      params.set("r", filters.rarities.join(","));
    }
    if (filters.colors && filters.colors.length > 0) {
      params.set("c", filters.colors.join(","));
    }
    if (filters.colorMode === "any") {
      params.set("cm", "any");
    }
    if (filters.foil && filters.foil !== "all") {
      params.set("foil", filters.foil);
    }
    if (filters.tokens === "show") {
      params.set("tokens", "show");
    }
    if (typeof filters.minPrice === "number" && filters.minPrice > 0) {
      params.set("min", String(filters.minPrice));
    }
    if (typeof filters.maxPrice === "number" && filters.maxPrice < 100) {
      params.set("max", String(filters.maxPrice));
    }
    if (filters.sortBy && filters.sortBy !== "price_desc") {
      params.set("sort", filters.sortBy);
    }

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    
    // Silent update in browser bar without reload
    window.history.replaceState(null, "", newUrl);
  } catch {}
}

// Build full shareable URL for any specific preset
export function buildPresetUrl(filters: {
  rarities?: string[];
  colors?: string[];
  colorMode?: "exact" | "any";
  foil?: "all" | "foil" | "nonfoil";
  tokens?: "hide" | "show";
  minPrice?: number;
  maxPrice?: number;
  edition?: string;
  search?: string;
  sortBy?: string;
}): string {
  if (typeof window === "undefined") return "";

  try {
    const params = new URLSearchParams();

    if (filters.search && filters.search.trim()) {
      params.set("q", filters.search.trim());
    }
    if (filters.edition && filters.edition !== "all") {
      params.set("ed", filters.edition);
    }
    if (filters.rarities && filters.rarities.length > 0) {
      params.set("r", filters.rarities.join(","));
    }
    if (filters.colors && filters.colors.length > 0) {
      params.set("c", filters.colors.join(","));
    }
    if (filters.colorMode === "any") {
      params.set("cm", "any");
    }
    if (filters.foil && filters.foil !== "all") {
      params.set("foil", filters.foil);
    }
    if (filters.tokens === "show") {
      params.set("tokens", "show");
    }
    if (typeof filters.minPrice === "number" && filters.minPrice > 0) {
      params.set("min", String(filters.minPrice));
    }
    if (typeof filters.maxPrice === "number" && filters.maxPrice < 100) {
      params.set("max", String(filters.maxPrice));
    }
    if (filters.sortBy && filters.sortBy !== "price_desc") {
      params.set("sort", filters.sortBy);
    }

    const qs = params.toString();
    return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
  } catch {
    return window.location.href;
  }
}

// Parse initial filters from URL when opening a link or bookmark
export function parseFiltersFromUrl(): Partial<FilterPreset> | null {
  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.size === 0) return null;

    const result: Partial<FilterPreset> = {};

    if (params.has("q")) result.search = params.get("q") || "";
    if (params.has("ed")) result.edition = params.get("ed") || "all";
    if (params.has("r")) {
      const r = params.get("r")?.split(",").filter(Boolean) || [];
      if (r.length) result.rarities = r;
    }
    if (params.has("c")) {
      const c = params.get("c")?.split(",").filter(Boolean) || [];
      if (c.length) result.colors = c;
    }
    if (params.has("cm")) {
      result.colorMode = params.get("cm") === "any" ? "any" : "exact";
    }
    if (params.has("foil")) {
      const f = params.get("foil");
      if (f === "foil" || f === "nonfoil") result.foil = f;
    }
    if (params.has("tokens")) {
      result.tokens = params.get("tokens") === "show" ? "show" : "hide";
    }
    if (params.has("min")) {
      const min = parseFloat(params.get("min") || "0");
      if (!isNaN(min)) result.minPrice = min;
    }
    if (params.has("max")) {
      const max = parseFloat(params.get("max") || "100");
      if (!isNaN(max)) result.maxPrice = max;
    }
    if (params.has("sort")) {
      result.sortBy = params.get("sort") || "price_desc";
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
