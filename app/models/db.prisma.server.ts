import prisma from "../db.server"

// Create a new widget for the shop
export async function createWidgetSettings({
  shop,
  title,
  template,
  status,
  settings,
}: {
  shop: string;
  title: string;
  template?: string;
  status: boolean;
  settings: any;
}) {
  // Always create a new widget (no update)
  const data: any = {
    shop,
    title,
    status,
    settings,
  };
  if (template) {
    data.template = template;
  }

  const widget = await prisma.widget.create({
    data,
  });

  return widget;
}

export async function createDiscountSetting(
  {
    widgetId,
    bundleName,
    discountName,
    visibility,
    productIds,
    collectionIds,
    discountLogic,
    startDate,
    endDate,
  }: {
    widgetId: number;
    bundleName: string;
    discountName: string;
    visibility:string;
    productIds: string[];
    collectionIds: string[],
    discountLogic: any;
    startDate: Date;
    endDate?: Date;
  }
) {
  // Create discount rows for each product (or ALL_PRODUCTS if empty)
  const discountRows = await Promise.all(
    (productIds.length ? productIds : [null]).map((productId) =>
      prisma.discountSettings.create({
        data: {
          widgetId, // ✅ directly link widget
          bundleName,
          discountName,
          discountLogic,
          productIds: productId ? [productId] : [],
          collectionIds : collectionIds ? collectionIds : [],
          appliesTo: visibility as any,
          startDate,
          endDate,
        },
      })
    )
  );

  return discountRows;
}

export async function getDiscountSettingsByShop(shop: string) {
  return prisma.discountSettings.findMany({
    where: { 
      widget: {
        shop: shop
      }
    },
  });
}

export async function getWidgetSettingsByShop(shop: string) {
  try {
    return await prisma.widget.findMany({
      where: {
        shop: shop,
      },
      include: {
        discounts: true, // include all DiscountSettings linked to this widget
      },
    });
  } catch (error) {
    console.error("Error fetching widget settings:", error);
    return [];
  }
}

export async function getWidgetSettingsByShopAndId(shop: string, id: string) {
  var productShopifyId = "gid://shopify/Product/" + id;
  // Return rows that either apply globally (ALL_PRODUCTS) or apply to this
  // product specifically, but exclude rows that represent exclusions
  // (ALL_PRODUCTS_NOT_SOME) for this specific product id.
  return prisma.discountSettings.findMany({
    where: {
      widget: {
        shop: shop,
      },
      OR: [
        // Global entries (apply to all products via sentinel)
        { productIds: { has: "ALL_PRODUCTS" } },
        // Product-specific entries (SPECIFIC_PRODUCTS, SPECIFIC_COLLECTIONS)
        {
          AND: [
            { productIds: { has: productShopifyId } },
            { NOT: { appliesTo: "ALL_PRODUCTS_NOT_SOME" } },
          ],
        },
        // ALL_PRODUCTS_NOT_SOME entries where this product is NOT in the exclusion list
        {
          AND: [
            { appliesTo: "ALL_PRODUCTS_NOT_SOME" },
            { NOT: { productIds: { has: productShopifyId } } },
          ],
        },
      ],
    },
    include: {
      widget: true, // include related widget
    },
  });
}

export async function getWidgetById(shop: string, id: string) {
  try {
    return await prisma.widget.findFirst({
      where: {
        id: parseInt(id),
        shop: shop
      },
      include: {
        discounts: true
      }
    });
  } catch (error) {
    console.error("Error fetching widget by ID:", error);
    return null;
  }
}

export async function updateWidgetSettings(id: string, data: {
  title: string;
  template?: string;
  status: boolean;
  settings: any;
}) {
  try {
    const updateData: any = {
      title: data.title,
      status: data.status,
      settings: data.settings,
    };
    if (data.template) {
      updateData.template = data.template;
    }

    return await prisma.widget.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
  } catch (error) {
    console.error("Error updating widget settings:", error);
    throw error;
  }
}

export async function updateDiscountSettings(id: string, data: {
  bundleName: string;
  discountName: string;
  visibility: string;
  productIds: string[];
  collectionIds: string[];
  discountLogic: any;
  startDate: Date;
  endDate?: Date;
}) {
  try {
    return await prisma.discountSettings.update({
      where: { id: parseInt(id) },
      data: {
        bundleName: data.bundleName,
        discountName: data.discountName,
        appliesTo: data.visibility as any,
        productIds: data.productIds,
        collectionIds: data.collectionIds,
        discountLogic: data.discountLogic,
        startDate: data.startDate,
        endDate: data.endDate
      }
    });
  } catch (error) {
    console.error("Error updating discount settings:", error);
    throw error;
  }
}

export async function deleteDiscountSettings(shop: string, id: string) {
  try {
    // First delete the widget and its related discount settings
    const result = await prisma.widget.delete({
      where: {
        id: parseInt(id),
        shop: shop
      }
    });
    return result;
  } catch (error) {
    console.error("Error deleting discount settings:", error);
    throw error;
  }
}