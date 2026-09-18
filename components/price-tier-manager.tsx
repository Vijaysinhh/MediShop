'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimePriceTiers } from '@/hooks/use-realtime-price-tiers';
import type { Unit, PriceTier } from '@/lib/db';
import { calculatePricingMetrics } from '@/lib/pricing-calculator';
import { formatMoney, formatPercent, formatWholeNumber, parseWholeNumberInput } from '@/lib/number-format';

interface PriceTierManagerProps {
  itemId?: number;
  priceTiers: PriceTier[];
  units: Unit[];
  wholesaleCost: number;
  wholesaleUnitId: number;
  onAdd: (tier: Omit<PriceTier, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (tierId: number) => void;
}

export function PriceTierManager({
  itemId,
  units,
  wholesaleCost,
  wholesaleUnitId,
  onAdd,
  onDelete,
}: PriceTierManagerProps) {
  const [newTier, setNewTier] = useState({
    quantity: '',
    unitId: wholesaleUnitId || units[0]?.id || 0,
    price: '',
  });

  const { priceTiers, isConnected } = useRealtimePriceTiers(itemId || null);

  const getUnitName = (unitId: number) => {
    const unit = units.find((item) => item.id === unitId);
    return unit?.shortForm || unit?.name || 'unit';
  };

  const getMetrics = (price: number, quantity: number, tierUnitId: number) => {
    if (!Number.isFinite(wholesaleCost) || wholesaleCost <= 0) {
      return { cost: 0, profit: 0, margin: 0, markup: 0 };
    }

    return calculatePricingMetrics(
      wholesaleCost,
      getUnitName(wholesaleUnitId),
      quantity,
      getUnitName(tierUnitId),
      price,
    );
  };

  const handleAdd = () => {
    if (!newTier.quantity || !newTier.price || !itemId) return;

    onAdd({
      itemId,
      quantity: parseWholeNumberInput(newTier.quantity),
      unitId: newTier.unitId,
      price: parseWholeNumberInput(newTier.price),
    });

    setNewTier({ quantity: '', unitId: wholesaleUnitId || units[0]?.id || 0, price: '' });
  };

  const previewMetrics = newTier.price && newTier.quantity
    ? getMetrics(
        parseWholeNumberInput(newTier.price),
        parseWholeNumberInput(newTier.quantity),
        newTier.unitId,
      )
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold">Price variants</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add another pack size or selling price for this item.
            </p>
          </div>
          {isConnected && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              Saved live
            </span>
          )}
        </div>

        <div className="mt-5 rounded-2xl border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">Your normal buying price</p>
          <p className="mt-1 text-muted-foreground">
            ₹{formatMoney(wholesaleCost)} per {getUnitName(wholesaleUnitId)}
          </p>
        </div>

        <section className="mt-7 border-t pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">Saved price variants</p>
            <span className="text-xs font-medium text-muted-foreground">
              {priceTiers.length}
            </span>
          </div>

          {priceTiers.length === 0 ? (
            <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              No extra pack prices added yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {priceTiers.map((tier) => {
                const metrics = getMetrics(tier.price, tier.quantity, tier.unitId);

                return (
                  <div key={tier.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold">
                          {formatWholeNumber(tier.quantity)} {getUnitName(tier.unitId)}
                        </p>
                        <p className="shrink-0 text-lg font-bold text-primary">
                          ₹{formatMoney(tier.price)}
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Cost ₹{formatMoney(metrics.cost)} · You earn ₹{formatMoney(metrics.profit)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        {formatPercent(metrics.margin)}% margin
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Delete price variant"
                      onClick={() => onDelete(tier.id || 0)}
                      className="h-10 w-10 shrink-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-7 border-t pt-6">
          <p className="text-sm font-bold">Add a price variant</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Example: sell a 50 g pack at a different price.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm font-semibold">
              Pack quantity
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newTier.quantity}
                onChange={(event) => setNewTier({ ...newTier, quantity: String(parseWholeNumberInput(event.target.value) || '') })}
                placeholder="e.g. 50"
                className="mt-1.5 min-w-0"
              />
            </label>
            <label className="min-w-0 text-sm font-semibold">
              Unit
              <Select value={newTier.unitId.toString()} onValueChange={(value) => setNewTier({ ...newTier, unitId: Number(value) })}>
                <SelectTrigger className="mt-1.5 min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id!.toString()}>
                      {unit.name} ({unit.shortForm})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="mt-4 block text-sm font-semibold">
            Selling price <span className="text-destructive">*</span>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newTier.price}
                onChange={(event) => setNewTier({ ...newTier, price: String(parseWholeNumberInput(event.target.value) || '') })}
                placeholder="0"
                className="pl-7 text-base"
              />
            </div>
          </label>

          {previewMetrics && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <p className="font-semibold">
                You earn ₹{formatMoney(previewMetrics.profit)} · {formatPercent(previewMetrics.margin)}% margin
              </p>
              <p className="mt-1 text-xs">
                Your cost for this pack: ₹{formatMoney(previewMetrics.cost)}
              </p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleAdd}
            disabled={!newTier.quantity || !newTier.price}
            className="mt-5 h-12 w-full rounded-xl text-base font-bold"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add price variant
          </Button>
        </section>
      </div>
    </div>
  );
}
