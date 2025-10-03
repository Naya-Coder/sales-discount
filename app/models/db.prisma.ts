import prisma from "../db.server"

// Create a new widget for the shop
export async function createWidgetSettings({
  shop,
  title,
  status,
  settings,
}: {
  shop: string;
  title: string;
  status: boolean;
  settings: any;
}) {
  // Always create a new widget (no update)
  const widget = await prisma.widget.create({
    data: {
      shop,
      title,
      status,
      settings,
    },
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
          appliesTo: visibility,
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
    where: { shop },
  });
}

export async function getWidgetSettingsByShop(shop: string) {
  return await prisma.widget.findMany({
    where: {
      shop, // shorthand for shop: shop
    },
    include: {
      discounts: true, // include all DiscountSettings linked to this widget
    },
  });
}

export async function getWidgetSettingsByShopAndId(shop: string, id: string) {
  var productShopifyId = "gid://shopify/Product/" + id;
  var productIds = [productShopifyId, "ALL_PRODUCTS"];
  return prisma.discountSettings.findMany({
    where: { shop, productId: { in: productIds } },
    include: {
      widgetSettings: true, // include related discount settings
    },
  });
}

export async function deleteDiscountSettings(shop:string, id:string){
  // return prisma.discountSettings.
  return 123;
}