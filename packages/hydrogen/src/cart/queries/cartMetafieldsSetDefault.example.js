import {cartMetafieldsSetDefault} from '@shopify/hydrogen';

const cartSetMetafields = cartMetafieldsSetDefault({
  storefront,
  getCartId,
});

const result = await cartSetMetafields([
  {
    key: 'public.gift',
    type: 'boolean',
    value: 'true',
  },
]);
