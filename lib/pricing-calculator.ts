// Universal pricing calculator - clean and reusable
// All calculations follow the standard formulas
// Optimized for shopkeepers buying in bulk and selling in smaller units

import { convertUnits } from './unit-converter';

export interface PricingMetrics {
  cost: number;
  profit: number;
  margin: number; // percentage
  markup: number; // percentage
}

export interface PricingBreakdown {
  metrics: PricingMetrics;
  steps: {
    tierQtyInBaseUnit: number;
    formula: string;
  };
}

/**
 * Calculate pricing metrics for a product tier
 * Perfect for shopkeepers: Buy 3kg rice, sell 50g portions
 * 
 * @param costPerBaseUnit - Cost per unit in base unit (e.g., ₹200 per kg)
 * @param baseUnitShortForm - Base unit short form (e.g., 'kg')
 * @param tierQuantity - Quantity being sold (e.g., 50)
 * @param tierUnitShortForm - Tier unit short form (e.g., 'g')
 * @param sellingPrice - Selling price for this tier (e.g., ₹15)
 * @returns PricingMetrics with cost, profit, margin%, markup%
 * 
 * Example:
 * calculatePricingMetrics(200, 'kg', 50, 'g', 15)
 * → { cost: 10, profit: 5, margin: 33.33, markup: 50 }
 */
export function calculatePricingMetrics(
  costPerBaseUnit: number,
  baseUnitShortForm: string,
  tierQuantity: number,
  tierUnitShortForm: string,
  sellingPrice: number
): PricingMetrics {
  // Validate inputs
  if (costPerBaseUnit < 0 || tierQuantity < 0 || sellingPrice < 0) {
    console.warn('[v0] Invalid input: negative values not allowed');
    return { cost: 0, profit: 0, margin: 0, markup: 0 };
  }

  // Step 1: Convert tier quantity to base unit
  // Example: 50g → 0.05kg
  const tierQtyInBaseUnit = convertUnits(tierQuantity, tierUnitShortForm, baseUnitShortForm);

  // Step 2: Calculate cost
  // Formula: Cost = costPerBaseUnit × tierQtyInBaseUnit
  // Example: 200 × 0.05 = 10
  const cost = costPerBaseUnit * tierQtyInBaseUnit;

  // Step 3: Calculate profit
  // Formula: Profit = Selling Price - Cost
  // Example: 15 - 10 = 5
  const profit = sellingPrice - cost;

  // Step 4: Calculate margin percentage
  // Formula: Margin = (Profit / Selling Price) × 100
  // Example: (5 / 15) × 100 = 33.33%
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  // Step 5: Calculate markup percentage
  // Formula: Markup = (Profit / Cost) × 100
  // Example: (5 / 10) × 100 = 50%
  const markup = cost > 0 ? (profit / cost) * 100 : 0;

  return {
    cost: parseFloat(cost.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    margin: parseFloat(margin.toFixed(2)),
    markup: parseFloat(markup.toFixed(2)),
  };
}

/**
 * Simple version if you already have cost and only need margin/markup
 * Use this when cost is already calculated elsewhere
 */
export function calculateMargins(
  cost: number,
  sellingPrice: number
): { margin: number; markup: number } {
  if (cost < 0 || sellingPrice < 0) {
    return { margin: 0, markup: 0 };
  }

  const profit = sellingPrice - cost;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  const markup = cost > 0 ? (profit / cost) * 100 : 0;

  return {
    margin: parseFloat(margin.toFixed(2)),
    markup: parseFloat(markup.toFixed(2)),
  };
}

/**
 * Calculate what selling price is needed to achieve target margin
 * Useful for shopkeepers to auto-calculate prices
 * 
 * @param cost - Product cost
 * @param targetMarginPercent - Desired margin percentage (e.g., 30 for 30%)
 * @returns Required selling price
 * 
 * Formula: Selling Price = Cost / (1 - (Margin% / 100))
 */
export function calculatePriceForTargetMargin(
  cost: number,
  targetMarginPercent: number
): number {
  if (cost <= 0 || targetMarginPercent >= 100) return 0;
  const sellingPrice = cost / (1 - targetMarginPercent / 100);
  return parseFloat(sellingPrice.toFixed(2));
}

/**
 * Calculate what selling price is needed to achieve target markup
 * 
 * @param cost - Product cost
 * @param targetMarkupPercent - Desired markup percentage (e.g., 50 for 50%)
 * @returns Required selling price
 * 
 * Formula: Selling Price = Cost × (1 + (Markup% / 100))
 */
export function calculatePriceForTargetMarkup(
  cost: number,
  targetMarkupPercent: number
): number {
  if (cost < 0) return 0;
  const sellingPrice = cost * (1 + targetMarkupPercent / 100);
  return parseFloat(sellingPrice.toFixed(2));
}
