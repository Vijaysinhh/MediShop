"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useItems, useUnits, usePriceTiers } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Check, Search, Plus, X } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";
import { calculatePriceTierCost, convertUnit } from "@/lib/unit-conversion";
import { toast } from "sonner";
import {
  formatMoney,
  formatNumber,
  formatWholeNumber,
  parseNumberInput,
} from "@/lib/number-format";
import type { Item, PriceTier } from "@/lib/db";
import dynamic from "next/dynamic";
import { normalizeVoiceText } from "@/lib/voice-sale-parser";
import { convertVoiceQuantity } from "@/lib/voice-sale-matching";
import { voiceSaleEnabled } from "@/lib/feature-flags";
import { SaleQuantityControl } from "./sale-quantity-control";
import { maxSaleQuantity } from "@/lib/sale-quantity";

// Keep experimental voice code in its own chunk. Production does not request
// this chunk while the feature flag is off.
const VoiceSaleAssistant = dynamic(
  () => import("./voice-sale-assistant").then((module) => module.VoiceSaleAssistant),
  { ssr: false },
);

interface SaleLineItem {
  itemId: number;
  itemName: string;
  quantity: number;
  displayQuantity: string;
  unitId: number;
  unitShortForm: string;
  priceTierId?: number;
  packCount?: number;
  priceTierQuantity?: number;
  priceTierUnitShortForm?: string;
  pricePerUnit: number;
  totalPrice: number;
  costPerUnit: number;
  totalCost: number;
}

interface SalesItemSearchProps {
  onItemAdded: (item: SaleLineItem) => void;
  addedItems: SaleLineItem[];
  itemToEdit?: SaleLineItem;
  onItemEdited?: (item: SaleLineItem) => void;
}

export function SalesItemSearch({
  onItemAdded,
  addedItems,
  itemToEdit,
  onItemEdited,
}: SalesItemSearchProps) {
  const { currentShopId } = useAuth();
  const { items } = useItems(currentShopId);
  const { units } = useUnits(currentShopId);
  const { priceTiers } = usePriceTiers(currentShopId);
  const { t, language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPriceTier, setSelectedPriceTier] = useState<PriceTier | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedItem) {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }
  }, [selectedItem?.id]);
  const [voiceReplacement, setVoiceReplacement] = useState<{ query: string; resolve: (itemId: number) => void } | null>(null);
  const voiceProductAdded = useRef<(() => void) | null>(null);

  useEffect(() => {
    setVoiceReplacement(null);
    voiceProductAdded.current = null;
  }, [currentShopId]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(() => setIsSearching(false), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  // Initialize from itemToEdit if provided
  useEffect(() => {
    if (itemToEdit) {
      const originalItem = items.find((i) => i.id === itemToEdit.itemId);
      if (originalItem) {
        setSelectedItem(originalItem);
        // Try to guess original quantity and price tier
        setQuantity(
          itemToEdit.packCount
            ? itemToEdit.packCount.toString()
            : itemToEdit.quantity.toString(),
        );
        if (itemToEdit.priceTierId) {
          const tier = priceTiers.find((t) => t.id === itemToEdit.priceTierId);
          setSelectedPriceTier(tier || null);
        } else {
          setSelectedPriceTier(null);
        }
      }
    } else {
      // Reset if no item to edit
      setSelectedItem(null);
      setQuantity("");
      setSelectedPriceTier(null);
    }
  }, [itemToEdit, items, priceTiers]);

  // Helper function to calculate actual quantity in item's base unit
  const calculateActualQuantity = (
    qty: number,
    priceTier: PriceTier | null,
  ): number => {
    if (!selectedItem || qty <= 0) return 0;

    if (priceTier) {
      const priceTierUnit = units.find((u) => u.id === priceTier.unitId);
      const itemUnit = units.find((u) => u.id === selectedItem.unitId);

      const tierQtyInItemUnit = convertUnit(
        priceTier.quantity,
        priceTierUnit?.shortForm || "",
        itemUnit?.shortForm || "",
      );

      return Number((qty * tierQtyInItemUnit).toFixed(9));
    }

    return qty;
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const compactSearch = searchTerm.trim().replace(/\s+/g, "").toLowerCase();
    const ignoredWords = new Set([
      "add",
      "please",
      "and",
      "ani",
      "aani",
      "then",
      "plus",
      "wale",
      "वाले",
      "रुपये",
      "रुपयाचे",
    ]);
    const tokens = normalizeVoiceText(searchTerm)
      .split(" ")
      .filter(
        (token) =>
          token.length > 1 &&
          !ignoredWords.has(token) &&
          !/^\d+(?:\.\d+)?$/.test(token),
      );

    return items
      .map((item) => {
        const catalogCode = String(item.catalogCode || "").replace(/\s+/g, "").toLowerCase();
        const searchable = normalizeVoiceText(
          [item.name, item.nameMarathi, item.brand, item.brandMarathi, item.catalogCode]
            .filter(Boolean)
            .join(" "),
        );
        const score = tokens.reduce(
          (total, token) => total + (searchable.includes(token) ? 1 : 0),
          0,
        );
        const exactPhrase = searchable.includes(normalizeVoiceText(searchTerm));
        const exactCatalogCode = Boolean(catalogCode) && catalogCode === compactSearch;
        return { item, score: score + (exactPhrase ? 2 : 0) + (exactCatalogCode ? 10 : 0) };
      })
      .filter(({ score }) => score > 0)
      .sort((first, second) => second.score - first.score)
      .filter(
        ({ item }, index, results) =>
          results.findIndex((entry) => entry.item.id === item.id) === index,
      )
      .slice(0, 10)
      .map(({ item }) => item);
  }, [searchTerm, items]);

  const filteredWithTierSummary = useMemo(() => {
    return filteredItems.map((item) => {
      const tiers = priceTiers.filter((t) => t.itemId === item.id);
      const tierSummaries: Array<{ price: number; label: string }> = [];
      for (const tier of tiers.slice(0, 3)) {
        const unit = units.find((u) => u.id === tier.unitId);
        tierSummaries.push({
          price: tier.price,
          label: `${formatWholeNumber(tier.quantity)}${unit?.shortForm ? " " + unit.shortForm : ""}`,
        });
      }
      const matchText = normalizeVoiceText(searchTerm);
      const exactPhrases = [
        item.name,
        item.nameMarathi,
        item.brand,
        item.brandMarathi,
        [item.name, item.brand].filter(Boolean).join(" "),
        [item.nameMarathi, item.brandMarathi].filter(Boolean).join(" "),
      ].filter(Boolean).map((value) => normalizeVoiceText(String(value)));
      const exactMatch = matchText.length > 1 && exactPhrases.includes(matchText);
      return {
        item,
        tierSummaries,
        tierCount: tiers.length,
        exactMatch,
      };
    });
  }, [filteredItems, priceTiers, searchTerm, units]);

  const itemPriceTiers = useMemo(() => {
    if (!selectedItem) return [];
    return priceTiers.filter((tier) => tier.itemId === selectedItem.id);
  }, [selectedItem, priceTiers]);

  const getRemainingStock = (item: Item) => {
    // Calculate total quantity in cart, but exclude the item we're currently editing
    let inCart = addedItems
      .filter((line) => line.itemId === item.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    // If editing an item, subtract its original quantity from inCart since we are replacing it
    if (itemToEdit && itemToEdit.itemId === item.id) {
      inCart -= itemToEdit.quantity;
    }
    // Now calculate remaining stock: current stock minus (other items in cart)
    return Math.max(0, item.quantity - inCart);
  };

  const isExpired = (item: Item) => {
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    if (!Number.isFinite(expiry.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
  };

  const clearSelectedProduct = () => {
    setSelectedItem(null);
    setQuantity("");
    setSelectedPriceTier(null);
    voiceProductAdded.current = null;
  };

  const handleSearchChange = (value: string) => {
    setSearchOpen(true);
    setSearchTerm(value);
    // Typing the next product abandons only the unfinished detail card. Items
    // already placed in the bill remain untouched.
    if (value.trim() && selectedItem && !itemToEdit) clearSelectedProduct();
  };

  const focusSearch = () => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
  };

  const handleQuickAdd = (item: Item) => {
    const unit = units.find((entry) => entry.id === item.unitId);
    const unitShortForm = unit?.shortForm || "unit";
    if (addedItems.some((line) => line.itemId === item.id)) return;
    const remaining = getRemainingStock(item);
    const initialQuantity = Math.min(1, remaining);
    if (initialQuantity <= 0 || isExpired(item)) return;
    const sellPrice = Number(item.sellPrice);
    const buyPrice = Number(item.buyPrice);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0 || !Number.isFinite(buyPrice)) {
      toast.error(("Set a selling price greater than zero first."));
      return;
    }
    const baseName = false ? item.nameMarathi : item.name;
    const brandName = false ? item.brandMarathi : item.brand;
    onItemAdded({
      itemId: item.id || 0,
      itemName: brandName ? `${baseName} (${brandName})` : baseName,
      quantity: initialQuantity,
      displayQuantity: `${formatNumber(initialQuantity)} ${unitShortForm}`,
      unitId: item.unitId,
      unitShortForm,
      pricePerUnit: sellPrice,
      totalPrice: initialQuantity * sellPrice,
      costPerUnit: buyPrice,
      totalCost: initialQuantity * buyPrice,
    });
  };

  const finishSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
    if (!itemToEdit) clearSelectedProduct();
    searchInputRef.current?.blur();
  };

  const handleItemSelect = (item: Item) => {
    if (voiceReplacement && item.id !== undefined) {
      voiceReplacement.resolve(item.id);
      setVoiceReplacement(null);
      setSearchTerm("");
      return;
    }
    voiceProductAdded.current = null;
    setSelectedItem(item);
    setSearchTerm("");
    setQuantity("1");
    setSelectedPriceTier(null);
  };

  const handleAddToCart = () => {
    const qty = parseNumberInput(quantity);
    if (!selectedItem || !quantity || !Number.isFinite(qty) || qty <= 0 || qty > maxQuantity || Number(selectedItem.sellPrice) <= 0) return;

    // Calculate actual quantity to be sold in item's base unit
    let totalQuantityToSell = qty;
    let availableQuantity = Number(getRemainingStock(selectedItem).toFixed(9));
    let quantityDisplay = `${formatNumber(qty)} ${units.find((u) => u.id === selectedItem.unitId)?.shortForm}`;

    if (selectedPriceTier) {
      const priceTierUnit = units.find(
        (u) => u.id === selectedPriceTier.unitId,
      );
      const itemUnit = units.find((u) => u.id === selectedItem.unitId);

      // Convert price tier quantity to item's base unit
      const tierQtyInItemUnit = convertUnit(
        selectedPriceTier.quantity,
        priceTierUnit?.shortForm || "",
        itemUnit?.shortForm || "",
      );

      // Total quantity to sell = number of price tiers * converted quantity per tier
      totalQuantityToSell = Number((qty * tierQtyInItemUnit).toFixed(9));
      quantityDisplay = `${formatNumber(qty)} x ${formatNumber(selectedPriceTier.quantity)} ${priceTierUnit?.shortForm}`;
    }

    // Check if quantity exceeds available stock (in same unit)
    if (totalQuantityToSell > availableQuantity) {
      const itemUnit = units.find(
        (u) => u.id === selectedItem.unitId,
      )?.shortForm;
      toast.error(
        `Not enough stock. Available: ${formatNumber(availableQuantity)} ${itemUnit}. Trying to sell: ${quantityDisplay}`,
      );
      return;
    }

    const itemUnit = units.find((u) => u.id === selectedItem.unitId);
    let pricePerUnit = selectedItem.sellPrice;
    const priceTierId = selectedPriceTier?.id;

    let costPerUnit = selectedItem.buyPrice;

    if (selectedPriceTier) {
      const priceTierUnit = units.find(
        (u) => u.id === selectedPriceTier.unitId,
      );

      // Convert price tier quantity to item's base unit
      const tierQtyInItemUnit = convertUnit(
        selectedPriceTier.quantity,
        priceTierUnit?.shortForm || "",
        itemUnit?.shortForm || "",
      );

      // Price per base unit = price for tier / tier quantity in base units
      // E.g., Rs. 50 for 200g (0.2 kg) = Rs. 250/kg
      pricePerUnit =
        tierQtyInItemUnit > 0
          ? selectedPriceTier.price / tierQtyInItemUnit
          : selectedItem.sellPrice;

      const calculatedCost = calculatePriceTierCost(
        selectedItem.buyPrice,
        selectedPriceTier.quantity,
        priceTierUnit?.shortForm || "",
        1,
        itemUnit?.shortForm || "",
      );

      // Cost per base unit = cost for tier / tier quantity in base units
      // E.g., Rs. 4.50 for 50g (0.05 kg) = Rs. 90/kg
      costPerUnit =
        tierQtyInItemUnit > 0
          ? typeof calculatedCost === "number" && !isNaN(calculatedCost)
            ? calculatedCost / tierQtyInItemUnit
            : selectedItem.buyPrice
          : selectedItem.buyPrice;
    }

    const priceTierUnit = selectedPriceTier
      ? units.find((u) => u.id === selectedPriceTier.unitId)
      : undefined;

    const newItem = {
      itemId: selectedItem.id || 0,
      itemName: (() => {
        const baseName = selectedItem.name;
        const brandName = selectedItem.brand;
        return brandName ? `${baseName} (${brandName})` : baseName;
      })(),
      quantity: totalQuantityToSell,
      displayQuantity: quantityDisplay,
      unitId: selectedItem.unitId,
      unitShortForm: itemUnit?.shortForm || "unit",
      priceTierId,
      packCount: selectedPriceTier ? qty : undefined,
      priceTierQuantity: selectedPriceTier?.quantity,
      priceTierUnitShortForm: priceTierUnit?.shortForm,
      pricePerUnit,
      totalPrice: totalQuantityToSell * pricePerUnit,
      costPerUnit: costPerUnit || selectedItem.buyPrice,
      totalCost: totalQuantityToSell * (costPerUnit || selectedItem.buyPrice),
    };

    if (itemToEdit && onItemEdited) {
      onItemEdited(newItem);
    } else {
      onItemAdded(newItem);
      voiceProductAdded.current?.();
      voiceProductAdded.current = null;
    }

    setSelectedItem(null);
    setQuantity("");
    setSelectedPriceTier(null);
    searchInputRef.current?.focus();
  };

  const selectedUnit = units.find((unit) => unit.id === selectedItem?.unitId)?.shortForm || "";
  const remainingStock = selectedItem ? getRemainingStock(selectedItem) : 0;
  const maxQuantity = maxSaleQuantity(remainingStock, 0, calculateActualQuantity(1, selectedPriceTier));

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
          ref={searchInputRef}
          type="text"
          placeholder={t("search_items")}
          value={searchTerm}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => handleSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || isSearching) return;
            const exact = filteredWithTierSummary.filter((entry) => entry.exactMatch);
            if (exact.length !== 1) return;
            event.preventDefault();
            handleQuickAdd(exact[0].item);
          }}
          className="h-10 pl-10 pr-20"
          autoFocus
          />
          {searchTerm.trim() && isSearching ? (
          <div className="absolute right-3 top-2.5 flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
            Searching
          </div>
        ) : searchTerm.trim() ? (
          <button type="button" onClick={() => { setSearchTerm(""); focusSearch(); }} className="absolute right-1 top-0 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={("Clear search")}>
            <X className="h-4 w-4" />
          </button>
          ) : null}
        </div>
        {searchOpen && !voiceReplacement && (
          <Button type="button" onClick={finishSearch} variant="outline" className="h-10 shrink-0 gap-1.5 rounded-lg border-indigo-200 px-3 text-indigo-700 hover:bg-indigo-50">
            <Check className="h-4 w-4" />
            <span className="flex flex-col items-start leading-none">
              <span className="text-xs font-bold">{formatNumber(new Set(addedItems.map((line) => line.itemId)).size)} {("selected")}</span>
              <span className="mt-1 text-[10px] font-medium">{("Done")}</span>
            </span>
          </Button>
        )}
      </div>

      {voiceSaleEnabled && <VoiceSaleAssistant
        key={currentShopId}
        items={items}
        units={units}
        addedItems={addedItems}
        onAdd={onItemAdded}
        onProductSelected={(itemId, spokenQuantity, requestedUnit, onAdded) => {
          const item = items.find((product) => product.id === itemId);
          if (!item) return;
          setVoiceReplacement(null);
          setSelectedItem(item);
          setSelectedPriceTier(null);
          setSearchTerm("");
          voiceProductAdded.current = onAdded || null;
          const baseUnit = units.find((unit) => unit.id === item.unitId)?.shortForm || "";
          const initialQuantity = convertVoiceQuantity(spokenQuantity, requestedUnit, baseUnit);
          setQuantity(initialQuantity === null ? "" : String(initialQuantity));
          window.setTimeout(() => document.getElementById("sale-product-details")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
        }}
        onSearchRequested={(query, resolve) => {
          voiceProductAdded.current = null;
          setVoiceReplacement({ query, resolve });
          setSelectedItem(null);
          setSearchTerm(query);
          window.setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
      />}

      {voiceSaleEnabled && voiceReplacement && <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-900" role="status">
        <span>{(`Choose a replacement for “${voiceReplacement.query}”. Quantity will be kept.`)}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setVoiceReplacement(null); setSearchTerm(""); }}>{("Cancel")}</Button>
      </div>}

      {searchOpen && searchTerm && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {isSearching ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
                  <div className="mb-2 h-3 w-40 rounded bg-slate-200" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            filteredWithTierSummary.map(
              ({ item, tierSummaries, tierCount, exactMatch }) => {
                const unitShort =
                  units.find((u) => u.id === item.unitId)?.shortForm || "unit";
                const remaining = getRemainingStock(item);
                const profitPer = Math.max(
                  0,
                  Number(item.sellPrice || 0) - Number(item.buyPrice || 0),
                );
                const marginPct =
                  Number(item.sellPrice || 0) > 0
                    ? (profitPer / Number(item.sellPrice || 0)) * 100
                    : 0;
                const lowStock = remaining <= Number(item.lowStockLimit || 0);
                const outOfStock = remaining <= 0;
                const expired = isExpired(item);
                const zeroPrice = !Number.isFinite(Number(item.sellPrice)) || Number(item.sellPrice) <= 0;
                const unavailable = outOfStock || expired || zeroPrice;
                const alreadyAdded = addedItems.some((line) => line.itemId === item.id);
                const baseName =
                  false
                    ? item.nameMarathi
                    : item.name;
                const brandName =
                  false
                    ? item.brandMarathi
                    : item.brand;
                const displayName = brandName
                  ? `${baseName} (${brandName})`
                  : baseName;

                return (
                  <div
                    key={item.id}
                    className={`border-b border-slate-200 bg-white p-3 last:border-b-0 transition ${
                      unavailable
                        ? "bg-gray-50/70 opacity-60"
                        : "hover:bg-violet-50/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-900">
                            {displayName}
                          </span>
                          {brandName && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {brandName}
                            </span>
                          )}
                          {exactMatch && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              exact match
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                            {t("stock")}: {formatWholeNumber(remaining)}{" "}
                            {unitShort}
                          </span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                            ₹{formatMoney(item.sellPrice)}/{unitShort}
                          </span>
                          {item.category && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {tierSummaries.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-violet-700">
                            <span className="font-semibold">Packs:</span>
                            {tierSummaries.slice(0, 2).map((t, idx) => (
                              <span
                                key={`${item.id}-${t.label}-${idx}`}
                                className="rounded bg-violet-50 px-1.5 py-0.5"
                              >
                                ₹{formatMoney(t.price)}/{t.label}
                              </span>
                            ))}
                            {tierCount > 2 && (
                              <span className="rounded bg-violet-50 px-1.5 py-0.5">
                                +{tierCount - 2}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-slate-500">
                            {zeroPrice
                              ? ("Selling price not set")
                              : expired
                              ? ("Expired")
                              : lowStock && !outOfStock
                              ? "Low stock"
                              : outOfStock
                                ? "Out of stock"
                                : "In stock"}
                          </div>
                          {marginPct >= 0 && (
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                marginPct >= 20
                                  ? "bg-emerald-100 text-emerald-800"
                                  : marginPct >= 10
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {marginPct.toFixed(0)}% margin
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-base font-extrabold leading-tight text-blue-700">
                          ₹{formatMoney(item.sellPrice)}
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                          Buy: ₹{formatMoney(item.buyPrice)}
                        </div>
                        <div className="mt-1 text-[10px] font-semibold text-green-700">
                          Profit: ₹{formatMoney(profitPer)}
                        </div>
                        {unavailable ? (
                          <span className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-slate-200 px-3 text-xs font-semibold text-slate-500">
                            {zeroPrice ? (("No price")) : expired ? (("Expired")) : (("Unavailable"))}
                          </span>
                        ) : voiceReplacement ? (
                          <button type="button" onClick={() => handleItemSelect(item)} className="mt-2 min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
                            {("Use product")}
                          </button>
                        ) : alreadyAdded ? (
                          <span className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
                            <Check className="h-4 w-4" /> {("Added")}
                          </span>
                        ) : (
                          <button type="button" onClick={() => handleQuickAdd(item)} className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">
                            <Plus className="h-4 w-4" /> {("Add")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              },
            )
          ) : (
            <div className="p-4 text-sm text-slate-500">
              No matching products found for “{searchTerm}”. Try a different
              item name or brand.
            </div>
          )}
        </div>
      )}

      {searchOpen && !searchTerm && !voiceReplacement && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          {("Type the next product name to continue selecting.")}
        </p>
      )}

      {selectedItem && (
        <Card id="sale-product-details" className="rounded-xl border-indigo-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="break-words text-base font-semibold text-slate-900">
                  {(() => {
                    const baseName = selectedItem.name;
                    const brandName = selectedItem.brand;
                    return brandName ? `${baseName} (${brandName})` : baseName;
                  })()}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
                <span>
                  {("Stock remaining:")}{" "}
                  {formatNumber(getRemainingStock(selectedItem))}{" "}
                  {units.find((u) => u.id === selectedItem.unitId)?.shortForm}
                </span>
                <span className="font-semibold text-blue-700">
                  {t("selling")}: ₹{formatMoney(selectedItem.sellPrice)}/
                  {units.find((u) => u.id === selectedItem.unitId)?.shortForm}
                </span>
                <span>
                  {t("buy")}: ₹{formatMoney(selectedItem.buyPrice)}/{selectedUnit}
                </span>
                {(() => {
                  const ppu =
                    Number(selectedItem.sellPrice || 0) -
                    Number(selectedItem.buyPrice || 0);
                  const mp =
                    Number(selectedItem.sellPrice || 0) > 0
                      ? (ppu / Number(selectedItem.sellPrice || 0)) * 100
                      : 0;
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        mp < 0
                          ? "bg-red-100 text-red-800"
                          : mp >= 20
                          ? "bg-emerald-100 text-emerald-800"
                          : mp >= 10
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {ppu >= 0 ? "+" : ""}₹{formatMoney(ppu)} · {mp.toFixed(0)}%
                    </span>
                  );
                })()}
              </div>
            </div>
            <button
              onClick={() => { setSelectedItem(null); voiceProductAdded.current = null; searchInputRef.current?.focus(); }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
              aria-label={("Clear selected item")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3">
            <SaleQuantityControl
              value={quantity}
              onChange={setQuantity}
              max={maxQuantity}
              unit={selectedPriceTier ? (("packs")) : selectedUnit}
              label={selectedPriceTier ? (("Number of packs")) : t("quantity")}
              language={language}
              inputRef={quantityInputRef}
              onSubmit={handleAddToCart}
            />
            {selectedPriceTier && <p className="mt-2 text-xs text-slate-500">
              {("Each pack:")} {formatNumber(selectedPriceTier.quantity)} {units.find((unit) => unit.id === selectedPriceTier.unitId)?.shortForm}
            </p>}
          </div>

          {itemPriceTiers.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1">
                <label className="text-xs font-semibold text-gray-700">
                  {t("price_tier")}
                </label>
                <HelpTooltip
                  text={
                    ("Choose a package like 50g, 100g, or 500ml.")
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setSelectedPriceTier(null)}
                  aria-pressed={!selectedPriceTier}
                  className={`min-h-12 rounded-lg border p-2 text-sm ${
                    !selectedPriceTier
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  ₹{formatMoney(selectedItem.sellPrice)} / {units.find((u) => u.id === selectedItem.unitId)?.shortForm}
                </button>
                {itemPriceTiers.map((tier) => {
                  const tierUnit = units.find((u) => u.id === tier.unitId);
                  return (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedPriceTier(tier)}
                      aria-pressed={selectedPriceTier?.id === tier.id}
                      className={`flex min-h-12 flex-1 items-center justify-center rounded border p-2 text-xs font-medium sm:min-h-auto sm:p-1.5 ${
                        selectedPriceTier?.id === tier.id
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {formatNumber(tier.quantity)}
                      {tierUnit?.shortForm} @ Rs. {formatMoney(tier.price)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {Number.isFinite(parseNumberInput(quantity)) && parseNumberInput(quantity) > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 border-t border-indigo-100 pt-3 text-sm">
              <span className="text-slate-600">{t("total_price")}</span>
              <span aria-live="polite" className="text-lg font-bold tabular-nums text-slate-900">₹{formatMoney(parseNumberInput(quantity) * (selectedPriceTier?.price ?? selectedItem.sellPrice))}</span>
            </div>
          )}
          <Button
            onClick={handleAddToCart}
            disabled={
              !quantity ||
              Number(selectedItem.sellPrice) <= 0 ||
              !Number.isFinite(parseNumberInput(quantity)) ||
              parseNumberInput(quantity) <= 0 ||
              parseNumberInput(quantity) > maxQuantity
            }
            className="h-auto min-h-12 w-full gap-2 whitespace-normal rounded-xl bg-green-600 py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t("add_to_sale")}
          </Button>
        </Card>
      )}
    </div>
  );
}
