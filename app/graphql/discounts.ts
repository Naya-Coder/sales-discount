export const CREATE_AUTOMATIC_DISCOUNT = `
 mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      userErrors {
        field
        message
      }
      automaticAppDiscount {
        discountId
        title
        startsAt
        endsAt
        status
        appDiscountType {
          appKey
          functionId
        }
      }
    }
  }
`;

export const UPDATE_AUTOMATIC_DISCOUNT = `
  mutation discountAutomaticAppUpdate($automaticAppDiscount: DiscountAutomaticAppInput!, $id: ID!) {
  discountAutomaticAppUpdate(automaticAppDiscount: $automaticAppDiscount, id: $id) {
    automaticAppDiscount {
      title
      discountId
    }
    userErrors {
      field
      message
    }
  }
}
`;
