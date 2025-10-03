// @ts-check

/**
 * @typedef {any} CartTransformRunInput
 * @typedef {any} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const operations = input.cart.lines.reduce((acc, line) => {
    const giftFlag = line.giftProduct?.value;
    const giftVariantRawId = line.variantId?.value; // e.g., "49461063254304"
    const quantityTrigger = line.packQuantity?.value;

    if (giftFlag === "true" && giftVariantRawId) {
      // Convert to GraphQL global ID
      const giftVariantId = `gid://shopify/ProductVariant/${giftVariantRawId}`;

      acc.push({
        lineExpand: {
          cartLineId: line.id,
          title: `${line.merchandise.title || "Product"} + Free Gift`,
          expandedCartItems: [
            {
              merchandiseId: line.merchandise.id,
              quantity: 1,
              price: {
                adjustment: { fixedPricePerUnit: { amount: line.cost.amountPerQuantity.amount } },
              },
            },
            {
              merchandiseId: giftVariantId, // ✅ use global ID
              quantity: 1,
              price: {
                adjustment: { fixedPricePerUnit: { amount: "0.0" } },
              },
            },
          ],
        },
      });
    }

    return acc;
  }, []);

  return operations.length > 0 ? { operations } : { operations: [] };
}

