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
