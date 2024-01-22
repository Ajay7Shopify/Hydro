import {StorefrontApiErrors, formatAPIResult} from '../../storefront';
import {MINIMAL_CART_FRAGMENT, USER_ERROR_FRAGMENT} from './cart-fragments';
import type {
  CartOptionalInput,
  CartQueryData,
  CartQueryDataReturn,
  CartQueryOptions,
} from './cart-types';
import type {CartBuyerIdentityInput} from '@shopify/hydrogen-react/storefront-api-types';

export type CartBuyerIdentityUpdateFunction = (
  buyerIdentity: CartBuyerIdentityInput,
  optionalParams?: CartOptionalInput,
) => Promise<CartQueryDataReturn>;

export function cartBuyerIdentityUpdateDefault(
  options: CartQueryOptions,
): CartBuyerIdentityUpdateFunction {
  return async (buyerIdentity, optionalParams) => {
    const {cartBuyerIdentityUpdate, errors} = await options.storefront.mutate<{
      cartBuyerIdentityUpdate: CartQueryData;
      errors: StorefrontApiErrors;
    }>(CART_BUYER_IDENTITY_UPDATE_MUTATION(options.cartFragment), {
      variables: {
        cartId: options.getCartId(),
        buyerIdentity,
        ...optionalParams,
      },
    });
    return formatAPIResult(cartBuyerIdentityUpdate, errors);
  };
}

//! @see https://shopify.dev/docs/api/storefront/latest/mutations/cartBuyerIdentityUpdate
export const CART_BUYER_IDENTITY_UPDATE_MUTATION = (
  cartFragment = MINIMAL_CART_FRAGMENT,
) => `#graphql
  mutation cartBuyerIdentityUpdate(
    $cartId: ID!
    $buyerIdentity: CartBuyerIdentityInput!
    $language: LanguageCode
    $country: CountryCode
  ) @inContext(country: $country, language: $language) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        ...CartApiMutation
      }
      userErrors {
        ...CartApiError
      }
    }
  }
  ${cartFragment}
  ${USER_ERROR_FRAGMENT}
`;
