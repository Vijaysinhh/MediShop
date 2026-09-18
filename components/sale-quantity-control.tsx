"use client";

import { useId, type Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanNumberInput, formatNumber } from "@/lib/number-format";
import { stepSaleQuantity } from "@/lib/sale-quantity";

export function SaleQuantityControl({ value, onChange, max, unit, label, language, disabled = false, inputRef, onSubmit, productName, pending = false }: {
  value: string;
  onChange: (value: string) => void;
  max: number;
  unit: string;
  label: string;
  language: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onSubmit?: () => void;
  productName?: string;
  pending?: boolean;
}) {
  const id = useId();
  const numeric = Number(value);
  const invalid = !value.trim() || !Number.isFinite(numeric) || numeric <= 0 || numeric > max;
  const overMax = Number.isFinite(numeric) && numeric > max;
  const accessibleLabel = productName ? `${label}: ${productName}` : label;
  const step = (direction: -1 | 1) => onChange(String(stepSaleQuantity(numeric, direction, max)));

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
        <span id={`${id}-max`} className="text-xs font-semibold text-red-600">
          {("Max:")} {formatNumber(max)} {unit}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/70 p-2 shadow-inner">
        <Button type="button" variant="ghost" size="icon" disabled={disabled || !(numeric > 0)} onClick={() => step(-1)}
          aria-label={`${("Decrease quantity")}: ${productName || label}`}
          className="h-11 w-11 shrink-0 touch-manipulation rounded-xl border border-slate-200 bg-white shadow-sm transition-transform active:scale-90">
          <Minus className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <Input ref={inputRef} id={id} type="text" inputMode="decimal" value={value} disabled={disabled}
            aria-label={accessibleLabel}
            aria-invalid={invalid} aria-describedby={`${id}-max${invalid ? ` ${id}-error` : ""}`}
            onChange={(event) => onChange(cleanNumberInput(event.target.value.replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))))}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => { if (event.key === "Enter" && onSubmit && !invalid) { event.preventDefault(); onSubmit(); } }}
            className={`h-11 rounded-xl bg-white px-1 text-center text-xl font-bold tabular-nums text-indigo-800 shadow-sm ${invalid ? "border-red-400" : "border-transparent"}`} />
        </div>
        <span className="max-w-16 break-words text-xs font-medium text-slate-500">{unit}</span>
        <Button type="button" variant="ghost" size="icon" disabled={disabled || max <= 0 || numeric >= max} onClick={() => step(1)}
          aria-label={`${("Increase quantity")}: ${productName || label}`}
          className="h-11 w-11 shrink-0 touch-manipulation rounded-xl bg-primary text-primary-foreground shadow-[0_4px_10px_rgba(79,70,229,0.28)] transition-transform hover:bg-primary/90 hover:text-primary-foreground active:scale-90">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      {invalid && (
        <div id={`${id}-error`} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" aria-live="polite">
          <span>{max <= 0 ? (("No stock available for this bill."))
            : overMax ? (("Quantity exceeds available stock."))
            : (("Enter a quantity greater than zero."))}</span>
          {overMax && max > 0 && <button type="button" disabled={disabled} className="min-h-11 font-semibold underline underline-offset-2" onClick={() => onChange(String(max))}>
            {(`Use ${formatNumber(max)} ${unit}`)}
          </button>}
        </div>
      )}
      {!invalid && pending && <button type="button" disabled={disabled} onClick={() => onChange(value)} className="min-h-11 text-sm font-semibold text-indigo-700 underline underline-offset-2">
        {("Apply this quantity")}
      </button>}
    </div>
  );
}
