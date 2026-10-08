"use client";

import { useState, useEffect } from "react";
import {
  X,
  Bookmark,
  QrCode,
  Share2,
  Check,
  Trash2,
  Plus,
  ArrowRight,
  Smartphone,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import QRCode from "qrcode";
import {
  FilterPreset,
  BUILTIN_PRESETS,
  getSavedPresets,
  savePresetToStorage,
  deletePresetFromStorage,
  encodePresetCode,
  decodePresetCode,
} from "@/lib/presets";

interface FilterPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: {
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
  };
  onApplyPreset: (preset: Partial<FilterPreset>) => void;
}

export function FilterPresetsModal({
  isOpen,
  onClose,
  currentFilters,
  onApplyPreset,
}: FilterPresetsModalProps) {
  const [activeTab, setActiveTab] = useState<"library" | "qr" | "code">("library");
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [inputCode, setInputCode] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2200);
  };

  // Load saved presets on open
  useEffect(() => {
    if (isOpen) {
      setSavedPresets(getSavedPresets());
      const code = encodePresetCode(currentFilters);
      setCurrentCode(code);

      // Generate QR Code with current URL
      if (typeof window !== "undefined") {
        QRCode.toDataURL(window.location.href, {
          width: 260,
          margin: 1,
          color: {
            dark: "#0b0d14",
            light: "#ffffff",
          },
        })
          .then(setQrCodeUrl)
          .catch((err) => console.error("QR Code Error:", err));
      }
    }
  }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const saved = savePresetToStorage({
      name: newPresetName.trim(),
      ...currentFilters,
    });
    setSavedPresets(getSavedPresets());
    setNewPresetName("");
    setIsSaving(false);
    showToast(`Saved "${saved.name}"`);
  };

  const handleDelete = (id: string, name: string) => {
    deletePresetFromStorage(id);
    setSavedPresets(getSavedPresets());
    showToast(`Removed "${name}"`);
  };

  const handleApply = (preset: Partial<FilterPreset>, name: string) => {
    onApplyPreset(preset);
    onClose();
  };

  const handleImportCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError("");
    const decoded = decodePresetCode(inputCode);
    if (!decoded) {
      setCodeError("Invalid preset code. Please check and try again.");
      return;
    }
    onApplyPreset(decoded);
    onClose();
  };

  const handleCopyCode = () => {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1017] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">Filter Presets</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Tab Switcher */}
        <div className="flex border-b border-white/[0.06] px-5 bg-[#0a0c12]">
          <button
            onClick={() => setActiveTab("library")}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "library"
                ? "border-amber-400 text-amber-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "qr"
                ? "border-amber-400 text-amber-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Mobile Sync</span>
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "code"
                ? "border-amber-400 text-amber-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Preset Code</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* TAB 1: Library */}
          {activeTab === "library" && (
            <div className="space-y-4">
              {/* Save Current Action */}
              {!isSaving ? (
                <button
                  type="button"
                  onClick={() => setIsSaving(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-amber-400/35 hover:border-amber-400/70 bg-amber-400/[0.03] hover:bg-amber-400/[0.07] text-amber-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Current Filter Preset</span>
                </button>
              ) : (
                <form onSubmit={handleSaveCurrent} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                  <div className="text-xs font-medium text-slate-300">Name this preset</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Commander Foils, Modern Staples..."
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="flex-1 bg-[#090b10] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={!newPresetName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition disabled:opacity-50 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSaving(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Saved User Presets */}
              {savedPresets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    My Presets
                  </div>
                  <div className="space-y-1.5">
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-amber-400/30 transition group"
                      >
                        <button
                          type="button"
                          onClick={() => handleApply(preset, preset.name)}
                          className="flex-1 text-left cursor-pointer"
                        >
                          <div className="text-xs font-medium text-slate-100 group-hover:text-amber-300 transition">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                            {preset.rarities.length > 0 && <span>{preset.rarities.join(", ")}</span>}
                            {preset.colors.length > 0 && <span>• {preset.colors.join("")}</span>}
                            {preset.foil !== "all" && <span>• {preset.foil}</span>}
                            {(preset.minPrice > 0 || preset.maxPrice < 100) && (
                              <span>• ${preset.minPrice}-${preset.maxPrice}</span>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(preset.id, preset.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition cursor-pointer"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Built-in Presets */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Standard Presets
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BUILTIN_PRESETS.map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => handleApply(bp, bp.name)}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-amber-400/40 text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition">
                        {bp.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {bp.id === "all" && "Clear all filters"}
                        {bp.id === "high_rares" && "Rare & Mythic cards"}
                        {bp.id === "multicolor" && "2+ colors cards"}
                        {bp.id === "foils" && "Foil versions only"}
                        {bp.id === "budget" && "Under $2 / ~70฿"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Method 1 - Mobile Sync (QR Code) */}
          {activeTab === "qr" && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="p-3 bg-white rounded-xl shadow-lg border border-white/20">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Filter QR Code"
                    className="w-48 h-48 block rounded-md"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-500">
                    Generating QR...
                  </div>
                )}
              </div>
              <div className="space-y-1 max-w-xs">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-200">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Scan to open on mobile</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Open your phone camera to scan. The current filter preset will open directly on your mobile browser.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Method 2 - Preset Code (Deck-Code style) */}
          {activeTab === "code" && (
            <div className="space-y-4">
              {/* Export current code */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Current Filter Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentCode}
                    className="flex-1 bg-[#090b10] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-slate-300 select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Share this code with friends or paste it on another device to load this exact filter.
                </p>
              </div>

              {/* Import code */}
              <form onSubmit={handleImportCode} className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="text-xs font-medium text-slate-300">
                  Load Preset from Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste LJ-... code here"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="flex-1 bg-[#090b10] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-600 outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!inputCode.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Load</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                {codeError && (
                  <div className="text-[10px] text-red-400 font-medium">
                    {codeError}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Minimal Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-1.5">
            <Check className="w-3 h-3" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
