"use client";

import React, { useState, useMemo } from "react";
import { X, Copy, Check, Download, FileText, Sparkles, CheckSquare, Layers } from "lucide-react";
import type { CKCard } from "@/lib/cardkingdom";
import { formatArchidektCard } from "@/lib/archidekt";

interface ArchidektExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: Record<string, { card: CKCard; quantity: number }>;
  currentCards: CKCard[];
  searchQuery?: string;
  totalSearchCount?: number;
}

export function ArchidektExportModal({
  isOpen,
  onClose,
  selectedCards,
  currentCards,
  searchQuery = "",
  totalSearchCount = 0,
}: ArchidektExportModalProps) {
  const selectedList = useMemo(() => {
    return Object.values(selectedCards).filter((item) => item.quantity > 0);
  }, [selectedCards]);

  const hasSelected = selectedList.length > 0;

  // Source mode: 'selected' or 'current'
  const [sourceMode, setSourceMode] = useState<"selected" | "current">(
    hasSelected ? "selected" : "current"
  );

  // Quantity mode: 'stock' (card.qty_retail) or '1x'
  const [quantityMode, setQuantityMode] = useState<"1x" | "stock">("1x");

  // Include Collector Number in output (e.g. "1x Name (set) 123 F" vs "1x Name (set) F")
  const [includeCollectorNumber, setIncludeCollectorNumber] = useState<boolean>(false);

  // Copied state indicator
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Generate the formatted text
  const { exportText, cardCount, totalQuantity } = useMemo(() => {
    const targetCards =
      sourceMode === "selected" && hasSelected
        ? selectedList.map((item) => ({
            card: item.card,
            qty: quantityMode === "stock" ? Math.max(1, item.card.qty_retail || 1) : item.quantity,
          }))
        : currentCards.map((card) => ({
            card,
            qty: quantityMode === "stock" ? Math.max(1, card.qty_retail || 1) : 1,
          }));

    let totQty = 0;
    const lines = targetCards.map(({ card, qty }) => {
      totQty += qty;
      return formatArchidektCard(card, {
        quantity: qty,
        includeCollectorNumber,
      });
    });

    return {
      exportText: lines.join("\n"),
      cardCount: targetCards.length,
      totalQuantity: totQty,
    };
  }, [sourceMode, hasSelected, selectedList, currentCards, quantityMode, includeCollectorNumber]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = exportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = searchQuery
      ? `archidekt_${searchQuery.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`
      : "archidekt_export.txt";
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#0e111a] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.08] shrink-0 bg-[#121624]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Export to Archidekt</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                  Import Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ฟอร์แมตมาตรฐานสำหรับ Import เข้า Archidekt / Moxfield / Deckbuilders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options & Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0c0e17] space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Source Selection */}
            <div className="flex items-center gap-1.5 bg-[#141724] p-1 rounded-xl border border-white/[0.08]">
              {hasSelected && (
                <button
                  type="button"
                  onClick={() => setSourceMode("selected")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    sourceMode === "selected"
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>การ์ดในคิว ({selectedList.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSourceMode("current")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  sourceMode === "current"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>การ์ดบนหน้านี้ ({currentCards.length})</span>
              </button>
            </div>

            {/* Quantity Mode */}
            <div className="flex items-center gap-1.5 bg-[#141724] p-1 rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setQuantityMode("1x")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  quantityMode === "1x"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="ใบละ 1 ใบ สำหรับจัดเด็คหรือเช็คคอลเลกชัน"
              >
                1x แต่ละใบ
              </button>
              <button
                type="button"
                onClick={() => setQuantityMode("stock")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  quantityMode === "stock"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="ใช้จำนวนตามสต็อกที่มีในร้าน LungJi"
              >
                ตามสต็อกร้าน
              </button>
            </div>
          </div>

          {/* Collector Number Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeCollectorNumber}
                onChange={(e) => setIncludeCollectorNumber(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-400 cursor-pointer"
              />
              <span>ใส่หมายเลข Collector Number ด้วย (เช่น <code className="text-amber-300 font-mono">1x Card (som) 109</code>)</span>
            </label>

            <span className="text-[11px] font-mono text-slate-400">
              รวม: <strong className="text-white">{cardCount}</strong> ใบ (จำนวนทั้งหมด: <strong className="text-amber-300">{totalQuantity}</strong>)
            </span>
          </div>
        </div>

        {/* Textarea Preview */}
        <div className="p-4 sm:p-5 flex-1 min-h-[240px] flex flex-col">
          <div className="relative flex-1">
            <textarea
              readOnly
              value={exportText}
              className="w-full h-full min-h-[220px] max-h-[360px] p-3.5 bg-[#08090f] border border-white/[0.08] rounded-xl text-xs font-mono text-slate-200 resize-none outline-none focus:border-amber-400/50 select-all leading-relaxed"
              placeholder="1x Card Name (set) F"
            />
          </div>

          <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              💡 ตัวอย่าง: <code className="text-amber-300 font-mono">1x Akim, the Soaring Wind (c20) F</code>
            </span>
            <span className="text-slate-500">Archidekt / Moxfield Native Support</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#121624] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {isCopied ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" />
                คัดลอกลิสต์ลง Clipboard แล้ว! พร้อมวางใน Archidekt ได้ทันที
              </span>
            ) : (
              <span>กดคัดลอกแล้วไปวางที่หน้า <strong>Import Deck</strong> บน Archidekt ได้เลย</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="ดาวน์โหลดเป็นไฟล์ text (.txt)"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>ดาวน์โหลด .txt</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-md cursor-pointer ${
                isCopied
                  ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/40"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>คัดลอกสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกลิสต์ (Copy)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
