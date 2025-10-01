import {
  CREATE_AUTOMATIC_DISCOUNT,
  // UPDATE_AUTOMATIC_DISCOUNT,
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

const SHOPIFY_API_VERSION = "2025-04";

export async function createAutomaticDiscount(
  request: Request,
  discountInput: AutomaticAppDiscountInput
) {
  const { admin,session } = await authenticate.admin(request);
  console.log(discountInput,'discountInput in createAutomaticDiscount');
  
  //  const response = await admin.graphql(CREATE_AUTOMATIC_DISCOUNT, {
  //   variables: { automaticAppDiscount: discountInput }
  // });
  // const responseJson = await response.json();

   const url = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
// return session;
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
  request: Request,
  id: string,
  baseDiscount: BaseDiscount,
  configuration: {
    metafieldId: string;
    cartLinePercentage: number;
    orderPercentage: number;
    deliveryPercentage: number;
    collectionIds?: string[];
  },
) {
  const { admin } = await authenticate.admin(request);
  const discountId = id.includes("gid://")
    ? id
    : `gid://shopify/DiscountAutomaticApp/${id}`;

  const response = await admin.graphql(UPDATE_AUTOMATIC_DISCOUNT, {
    variables: {
      id: discountId,
      discount: {
        ...baseDiscount,
        metafields: [
          {
            id: configuration.metafieldId,
            value: JSON.stringify({
              cartLinePercentage: configuration.cartLinePercentage,
              orderPercentage: configuration.orderPercentage,
              deliveryPercentage: configuration.deliveryPercentage,
              collectionIds:
                configuration.collectionIds?.map((id) =>
                  id.includes("gid://") ? id : `gid://shopify/Collection/${id}`,
                ) || [],
            }),
          },
        ],
      },
    },
  });

  const responseJson = await response.json();
  return {
    errors: responseJson.data.discountUpdate?.userErrors as UserError[],
  };
}

export async function getDiscount(request: Request, id: string) {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(GET_DISCOUNT, {
    variables: {
      id: `gid://shopify/DiscountNode/${id}`,
    },
  });

  const responseJson = await response.json();
  if (
    !responseJson.data.discountNode ||
    !responseJson.data.discountNode.discount
  ) {
    return { discount: null };
  }

  const method =
    responseJson.data.discountNode.discount.__typename === "DiscountCodeApp"
      ? DiscountMethod.Code
      : DiscountMethod.Automatic;

  const {
    title,
    codes,
    combinesWith,
  } = responseJson.data.discountNode.discount;

  return {
    discount: {
      id,
      title,
      method,
      code: method === DiscountMethod.Code ? codes?.nodes?.[0]?.code : undefined,
      combinesWith,
    },
  };
}
