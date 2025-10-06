import {
  CREATE_AUTOMATIC_DISCOUNT,
  UPDATE_AUTOMATIC_DISCOUNT,
  // GET_DISCOUNT,
} from "../graphql/discounts";
import { authenticate } from "../shopify.server";

interface UserError {
  code?: string;
  message: string;
  field?: string[];
}

interface AutomaticAppDiscountInput {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  metafields: MetafieldInput[];
}

interface MetafieldInput {
  namespace: string;
  key: string;
  type: "json" | "string" | "integer" | "boolean";
  value: string; // always stringified JSON
}

interface MetafieldUpdateInput {
  id:string;
  namespace: string;
  key: string;
  type: "json" | "string" | "integer" | "boolean";
  value: string; // always stringified JSON
}

const SHOPIFY_API_VERSION = "2025-04";

export async function createAutomaticDiscount(
  request: Request,
  discountInput: AutomaticAppDiscountInput
) {
  const { admin,session } = await authenticate.admin(request);

   const url = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session?.accessToken, // auth
    },
    body: JSON.stringify({
      query: CREATE_AUTOMATIC_DISCOUNT,
      variables: { automaticAppDiscount: discountInput },
    }),
  });

  const responseJson = await response.json();

  return {
    data: responseJson.data?.discountAutomaticAppCreate?.automaticAppDiscount,
    errors: responseJson.data?.discountAutomaticAppCreate?.userErrors || [],
  };
}

export async function updateAutomaticDiscount(
  discountId: string,
  request: Request,
  discountInput: AutomaticAppDiscountInput
) {
  const { admin } = await authenticate.admin(request);
  const discountNodeId = discountId.includes("gid://")
    ? discountId
    : `gid://shopify/DiscountAutomaticApp/${discountId}`;

  const response = await admin.graphql(UPDATE_AUTOMATIC_DISCOUNT, {
    variables: {
      id: discountNodeId,
      automaticAppDiscount : discountInput
    },
  });

  const responseJson = await response.json();
  return {
    errors: responseJson.data.discountUpdate?.userErrors as UserError[],
  };
}

export async function getMetafieldsId(request: Request, id: string) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `
      query GetDiscountMetafields($id: ID!) {
        discountNode(id: $id) {
          metafields(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `,
    {
      variables: { id },
    }
  );

  return response;
}

