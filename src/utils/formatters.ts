/**
 * Currency & Number Formatting Utilities for Smart Business Manager
 * Configured for Indian Rupee (₹) standard
 */

export const formatCurrency = (val: number | string | undefined | null): string => {
  const num = typeof val === "string" ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return "₹0.00";
  return (
    "₹" +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

export const formatCurrencyCompact = (val: number | string | undefined | null): string => {
  const num = typeof val === "string" ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return "₹0";
  if (Math.abs(num) >= 10000000) {
    return "₹" + (num / 10000000).toFixed(1) + " Cr";
  }
  if (Math.abs(num) >= 100000) {
    return "₹" + (num / 100000).toFixed(1) + " L";
  }
  if (Math.abs(num) >= 1000) {
    return "₹" + (num / 1000).toFixed(1) + "k";
  }
  return formatCurrency(num);
};

export const formatDate = (dateStr: string): string => {
  try {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export interface DiscountInfo {
  mrp: number;
  sellingPrice: number;
  hasDiscount: boolean;
  discountAmount: number;
  discountPercent: number;
  savingsText: string;
  badgeText: string;
}

/**
 * Calculates discount details based on MRP and Selling Price
 * - Discount Amount = MRP - Selling Price
 * - Discount % = ((MRP - Selling Price) / MRP) * 100
 * - Handles zero/missing MRP safely
 */
export const getDiscountInfo = (
  mrpVal?: number | string | null,
  sellingPriceVal?: number | string | null
): DiscountInfo => {
  const sellingPrice = Math.max(
    0,
    typeof sellingPriceVal === "string" ? parseFloat(sellingPriceVal) || 0 : Number(sellingPriceVal || 0)
  );
  let mrp = Math.max(
    0,
    typeof mrpVal === "string" ? parseFloat(mrpVal) || 0 : Number(mrpVal || 0)
  );

  // Safely handle missing or zero MRP
  if (mrp <= 0) {
    mrp = sellingPrice;
  }

  const hasDiscount = mrp > sellingPrice && mrp > 0;
  const discountAmount = hasDiscount ? Math.round((mrp - sellingPrice) * 100) / 100 : 0;
  const discountPercent =
    hasDiscount && mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 1000) / 10 : 0;

  return {
    mrp,
    sellingPrice,
    hasDiscount,
    discountAmount,
    discountPercent,
    savingsText: hasDiscount ? `Save ${formatCurrency(discountAmount)}` : "",
    badgeText: hasDiscount ? `${discountPercent}% OFF` : "",
  };
};
