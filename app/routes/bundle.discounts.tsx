import { authenticate } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";
import {getWidgetSettingsByShopAndId} from "../models/db.prisma.server"
import type {LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  
  const shop = url.searchParams.get("shop");
  const id = url.searchParams.get("id");

  if (!shop || !id) {
    throw new Response("Missing shop or product id parameter", { status: 400 });
  }

  const widgetSettings = await getWidgetSettingsByShopAndId(shop,id);
  // console.log(widgetSettings,'widgetSettings in bundle discounts');
  return json({ shop, widgetSettings });
};
