import prisma from "../db.server"

export async function createDiscountSetting(
  data: {
    bundleName: string;
    discountName: string;
    productIds: string[];
    discountLogic: object;
    startDate: Date;
    endDate?: Date;
  }, shop: string) {
  const { bundleName, discountName, productIds, discountLogic, startDate, endDate } = data;

  const ids = (productIds && productIds.length > 0) ? productIds : ["ALL_PRODUCTS"];

  return prisma.$transaction(
    ids.map((pid) =>
      prisma.discountSettings.create({
        data: {
          shop,
          bundleName,
          discountName,
          productId: pid,             // one row per product (or sentinel for all)
          discountLogic,
          startDate,
          endDate: endDate || null,
        },
      })
    )
  );
}

export async function getDiscountSettingsByShop(shop: string) {
  return prisma.discountSettings.findMany({
    where: { shop },
  });
}

export async function getWidgetSettingsByShop(shop: string) {
  return prisma.discountSettings.findMany({
    where: { shop },
    include: {
      widgetSettings: true, // include related discount settings
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

// Create widget settings for one or more discount setting rows
export async function createWidgetSettings(params: {
  items: Array<{
    discountId: number;
    title: string;
    status?: boolean;
    settings: string; // JSON string
  }>;
}) {
  const { items } = params;
  if (!items.length) return [];
  return prisma.$transaction(
    items.map((item) =>
      prisma.widgetSettings.create({
        data: {
          discountId: item.discountId,
          title: item.title,
          status: item.status ?? false,
          settings: item.settings,
        },
      })
    )
  );
}
