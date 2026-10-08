"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Copy, Check, Download, FileText, CheckSquare, Sparkles, Trash2, Square } from "lucide-react";
import type { CKCard } from "@/lib/cardkingdom";
import { formatArchidektCard } from "@/lib/archidekt";

interface ArchidektExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: Record<string, { card: CKCard; quantity: number }>;
  currentCards: CKCard[];
  searchQuery?: string;
  totalSearchCount?: number;
  onToggleSelectAll?: () => void;
  isAllPageSelected?: boolean;
  onClearAll?: () => void;
}

export function ArchidektExportModal({
  isOpen,
  onClose,
  selectedCards,
  currentCards,
  searchQuery = "",
  totalSearchCount = 0,
  onToggleSelectAll,
  isAllPageSelected = false,
  onClearAll,
}: ArchidektExportModalProps) {
  // Extract user's individually selected cards from queue
  const selectedList = useMemo(() => {
    return Object.values(selectedCards).filter((item) => item.quantity > 0);
  }, [selectedCards]);

  const hasSelected = selectedList.length > 0;

  // Extra state: all search result cards when user chooses to load all (e.g. all 943 Dinosaurs)
  const [allSearchResultCards, setAllSearchResultCards] = useState<CKCard[] | null>(null);
  const [isLoadingAllResults, setIsLoadingAllResults] = useState<boolean>(false);

  // Copied state indicator
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Can we offer to load all search results? (search is active and total count > current cards)
  const canFetchAllSearch = totalSearchCount > currentCards.length && !!searchQuery;

  // Fetch all search results if requested
  const handleFetchAllSearchResults = async () => {
    if (isLoadingAllResults) return;
    setIsLoadingAllResults(true);
    try {
      const res = await fetch(`/api/cards?search=${encodeURIComponent(searchQuery)}&limit=2000`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.cards)) {
          setAllSearchResultCards(data.cards);
        }
      }
    } catch (e) {
      console.error("Failed to fetch all search results for export:", e);
    } finally {
      setIsLoadingAllResults(false);
    }
  };

  const handleClear = () => {
    setAllSearchResultCards(null);
    if (onClearAll) {
      onClearAll();
    }
  };

  // Determine active cards to export
  // DO NOT DEFAULT TO SELECTING CARDS! (User requirement: "อย่าทำเป็นดีฟอล ให้มีปุ่มไว้กดว่าเลือกทั้งหมด")
  const activeExportCards = useMemo<CKCard[]>(() => {
    if (allSearchResultCards && allSearchResultCards.length > 0) {
      return allSearchResultCards;
    }
    if (hasSelected) {
      return selectedList.map((item) => item.card);
    }
    // If nothing selected, DO NOT default! Return empty array.
    return [];
  }, [allSearchResultCards, hasSelected, selectedList]);

  // Generate formatted export text
  const { exportText, cardCount } = useMemo(() => {
    if (activeExportCards.length === 0) {
      return { exportText: "", cardCount: 0 };
    }

    const lines = activeExportCards.map((card) => {
      return formatArchidektCard(card, {
        quantity: 1, // Standard 1x import format for Archidekt
      });
    });

    return {
      exportText: lines.join("\n"),
      cardCount: lines.length,
    };
  }, [activeExportCards]);

  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!exportText) return;
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
    if (!exportText) return;
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        className="w-full max-w-4xl lg:max-w-5xl bg-[#0e111a] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[850px] cursor-default"
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
              </h2>
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
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-white/[0.06] bg-[#0c0e17] shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            {/* Select Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Select All Button */}
              {currentCards.length > 0 && onToggleSelectAll && (
                <button
                  type="button"
                  onClick={() => {
                    setAllSearchResultCards(null);
                    onToggleSelectAll();
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer border ${
                    isAllPageSelected && !allSearchResultCards
                      ? "bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-sm shadow-amber-500/20"
                      : "bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.1] text-slate-200 hover:text-white"
                  }`}
                  title={isAllPageSelected ? "ยกเลิกเลือกการ์ดในหน้านี้ทั้งหมด" : "เลือกการ์ดทั้งหมดในหน้านี้"}
                >
                  {isAllPageSelected && !allSearchResultCards ? (
                    <CheckSquare className="w-4 h-4 text-slate-950" />
                  ) : (
                    <Square className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {isAllPageSelected && !allSearchResultCards
                      ? "ยกเลิกเลือกทั้งหมด"
                      : `เลือกทั้งหมด (${currentCards.length})`}
                  </span>
                </button>
              )}

              {/* All Search Results Button (e.g. 943 Dinosaurs) */}
              {canFetchAllSearch && (
                <button
                  type="button"
                  onClick={handleFetchAllSearchResults}
                  disabled={isLoadingAllResults}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer border ${
                    allSearchResultCards && allSearchResultCards.length > 0
                      ? "bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-sm shadow-amber-500/20"
                      : "bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 text-amber-300"
                  }`}
                  title="โหลดการ์ดทั้งหมดจากผลการค้นหาเพื่อ Export"
                >
                  {isLoadingAllResults ? (
                    <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {allSearchResultCards && allSearchResultCards.length > 0
                      ? `เลือกผลค้นหาทั้งหมดแล้ว (${allSearchResultCards.length.toLocaleString()})`
                      : `เลือกผลค้นหาทั้งหมด (${totalSearchCount.toLocaleString()})`}
                  </span>
                </button>
              )}

              {/* Selected in Queue badge if user selected partial cards */}
              {hasSelected && !isAllPageSelected && !allSearchResultCards && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-semibold">
                  <CheckSquare className="w-4 h-4" />
                  <span>การ์ดที่เลือกไว้ ({selectedList.length})</span>
                </span>
              )}

              {/* Clear button if any cards are selected */}
              {(cardCount > 0 || allSearchResultCards) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  title="ล้างรายการที่เลือกทั้งหมด"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างการเลือก</span>
                </button>
              )}
            </div>

            {/* Total Count */}
            {cardCount > 0 && (
              <div className="text-xs sm:text-sm font-mono text-slate-300 shrink-0 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                รวม: <strong className="text-amber-400 font-bold">{cardCount}</strong> ใบ
              </div>
            )}
          </div>
        </div>

        {/* Textarea Preview or Empty State */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0a0c14]">
          {cardCount === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-[#08090f] border border-dashed border-white/[0.1] rounded-2xl flex-1 h-full">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
                <CheckSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">ยังไม่ได้เลือกการ์ด</h3>
              <p className="text-xs text-slate-400 mb-5 max-w-sm">
                กดเลือกการ์ดในหน้านี้ หรือเลือกผลลัพธ์ทั้งหมดเพื่อเตรียมนำไปวางใน Archidekt หรือ Moxfield
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {currentCards.length > 0 && onToggleSelectAll && (
                  <button
                    type="button"
                    onClick={() => {
                      setAllSearchResultCards(null);
                      onToggleSelectAll();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>เลือกทั้งหมด ({currentCards.length} ใบ)</span>
                  </button>
                )}
                {canFetchAllSearch && (
                  <button
                    type="button"
                    onClick={handleFetchAllSearchResults}
                    disabled={isLoadingAllResults}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-amber-300 text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoadingAllResults ? (
                      <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                    <span>เลือกผลค้นหาทั้งหมด ({totalSearchCount.toLocaleString()} ใบ)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col h-full min-h-0">
              <textarea
                readOnly
                value={exportText}
                className="w-full h-full flex-1 p-4 sm:p-5 bg-[#08090f] border border-white/[0.08] rounded-xl text-xs sm:text-sm font-mono text-slate-200 resize-none outline-none focus:border-amber-400/50 select-all leading-relaxed shadow-inner"
                placeholder="1x Card Name (set) 123 *F*"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#121624] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs sm:text-sm">
            {isCopied && (
              <span className="text-emerald-400 font-semibold flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4" />
                คัดลอกลงคลิปบอร์ดแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              disabled={cardCount === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="ดาวน์โหลดเป็นไฟล์ text (.txt)"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>ดาวน์โหลด .txt</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={cardCount === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isCopied
                  ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/40"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกลิสต์</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
