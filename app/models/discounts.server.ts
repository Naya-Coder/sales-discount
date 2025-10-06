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
  code?: string;
  startsAt: string;
  endsAt?: string | null;
  metafields: MetafieldInput[];
}

interface MetafieldInput {
  id?: string;
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

  if (!session?.accessToken) {
    throw new Error("No access token available");
  }

   const url = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: CREATE_AUTOMATIC_DISCOUNT,
      variables: { automaticAppDiscount: discountInput },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

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
  const { admin, session } = await authenticate.admin(request);
  
  if (!session?.accessToken) {
    throw new Error("No access token available");
  }
  
  const discountNodeId = discountId.includes("gid://")
    ? discountId
    : `gid://shopify/DiscountAutomaticApp/${discountId}`;

  const url = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: UPDATE_AUTOMATIC_DISCOUNT,
      variables: {
        id: discountNodeId,
        automaticAppDiscount: discountInput
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseJson = await response.json();
  return {
    data: responseJson.data?.discountAutomaticAppUpdate?.automaticAppDiscount,
    errors: responseJson.data?.discountAutomaticAppUpdate?.userErrors as UserError[],
  };
}

export async function getMetafieldsId(request: Request, id: string) {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.accessToken) {
    throw new Error("No access token available");
  }

  const url = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const query = `
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
  `;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query,
      variables: { id },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseJson = await response.json();
  return responseJson;
}

