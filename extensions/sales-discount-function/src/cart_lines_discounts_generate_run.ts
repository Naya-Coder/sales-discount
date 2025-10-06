import {
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
  DiscountClass,
} from "../generated/api";

export function cartLinesDiscountsGenerateRun(input: any) {
  if (!input.cart.lines.length) {
    throw new Error("No cart lines found");
  }

  const { orderPercentage, collectionIds, productIds, tiers, all, excludeProductIds } = parseMetafield(
    input.discount.metafield,
  );

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  const hasProductDiscountClass = input.discount.discountClasses.some(
    (c: any) => c.toLowerCase() === "product"
  );

  if (!hasOrderDiscountClass && !hasProductDiscountClass) {
    return { operations: [] };
  }

  const operations = [];
  // Product discounts per line using tiers
  if (hasProductDiscountClass) {
    const candidates = [];

    for (const line of input.cart.lines) {
      if (!line.merchandise || !("product" in line.merchandise)) continue;

      const productId = line.merchandise.product.id;
      const variantId = line.merchandise.id;
      const quantity = line.quantity;
      const applicableTier = Array.isArray(tiers)
        ? tiers
          .filter(
            (t) =>
              typeof t.quantity === "number" &&
              t.quantity > 0 &&
              t.quantity <= quantity &&
              typeof t.priceType === "string" &&
              ["percentage", "amount_off", "exact_price"].includes(t.priceType) &&
              typeof t.priceValue === "number" &&
              t.priceValue >= 0
          )
          .sort((a, b) => b.quantity - a.quantity)[0] || null
        : null;

      // --- 2️⃣ Check if this line is the gift product ---
      const matchedGiftTier = tiers?.find(
        (t:any) => t.giftVariantId === variantId
      );

      if (matchedGiftTier) {
        // Apply 100% discount to gift products
        candidates.push({
          message: `FREE GIFT`,
          targets: [{ cartLine: { id: line.id } }],
          value: { percentage: { value: 100 } },
        });
        continue;
      }

      // Determine scope for regular products
      const excluded = excludeProductIds.includes(productId);
      const inScopeByAll = all && !excluded;

      const inScopeByProduct = productIds.includes(productId) && !excluded;
      const inScopeByCollection = collectionIds.length > 0 && line.merchandise.product.inAnyCollection && !excluded;

      if (!(inScopeByAll || inScopeByProduct || inScopeByCollection)) continue;

      const qty = typeof line.quantity === "number" ? line.quantity : 1;

      // Pick best tier
      const applicable = Array.isArray(tiers)
        ? tiers
          .filter((t) => {
            const isValid =
              typeof t.quantity === "number" &&
              t.quantity > 0 &&
              t.quantity <= qty &&
              typeof t.priceType === "string" &&
              ["percentage", "amount_off", "exact_price"].includes(t.priceType) &&
              typeof t.priceValue === "number" &&
              t.priceValue >= 0;

            return isValid;
          })
          .sort((a, b) => b.quantity - a.quantity)[0] || null
        : null;

      if (!applicable) continue;

      if (applicable.priceType === "percentage" && applicable.priceValue > 0) {
        candidates.push({
          message: `${applicable.priceValue}% OFF PRODUCT`,
          targets: [{ cartLine: { id: line.id } }],
          value: { percentage: { value: applicable.priceValue } },
        });
      } else if (applicable.priceType === "amount_off" && applicable.priceValue > 0) {
        candidates.push({
          message: `£${applicable.priceValue.toFixed(2)} OFF PRODUCT`,
          targets: [{ cartLine: { id: line.id } }],
          value: { fixedAmount: { amount: applicable.priceValue } },
        });
      } else if (applicable.priceType === "exact_price") {
        candidates.push({
          message: `SET EXACT PRICE`,
          targets: [{ cartLine: { id: line.id } }],
          value: { fixedPrice: { amount: applicable.priceValue } },
        });
      }
    }

    if (candidates.length > 0) {
      operations.push({
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      });
    }
  }

  return { operations };
}

function parseMetafield(metafield: any) {
  try {
    const value = JSON.parse(metafield.value);

    // New schema with scope
    const scope = value.scope || {};
    const scopedProductIds = Array.isArray(scope.productIds) ? scope.productIds : [];
    const scopedCollectionIds = Array.isArray(scope.collectionIds) ? scope.collectionIds : [];
    const scopedAll = !!scope.all;
    const scopedExcludeProductIds = Array.isArray(scope.excludeProductIds) ? scope.excludeProductIds : [];

    // Back-compat legacy fields
    const legacyProductIds = Array.isArray(value.productIds) ? value.productIds : [];
    const legacyCollectionIds = Array.isArray(value.collectionIds) ? value.collectionIds : [];

    return {
      orderPercentage: value.orderPercentage || 0,
      collectionIds: scopedCollectionIds.length ? scopedCollectionIds : legacyCollectionIds,
      productIds: scopedProductIds.length ? scopedProductIds : legacyProductIds,
      all: scopedAll,
      excludeProductIds: scopedExcludeProductIds,
      tiers: Array.isArray(value.discountLogic?.tiers) ? value.discountLogic.tiers : value.tiers,
    };
  } catch (error) {
    console.error("Error parsing metafield", error);
    return {
      orderPercentage: 0,
      collectionIds: [],
      productIds: [],
      all: false,
      excludeProductIds: [],
      tiers: [],
    };
  }
}
