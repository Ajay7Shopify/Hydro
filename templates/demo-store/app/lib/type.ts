import {
  CountryCode,
  LanguageCode,
} from '@shopify/storefront-kit-react/storefront-api-types';

export type Locale = {
  language: LanguageCode;
  country: CountryCode;
  label: string;
  pathPrefix?: string;
  currency: string;
};

export type Localizations = Record<string, Locale>;

export type I18nLocale = {
  language: LanguageCode;
  country: CountryCode;
  label: string;
  pathPrefix: string;
  currency: string;
};

export enum CartAction {
  ADD_TO_CART = 'ADD_TO_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  UPDATE_CART = 'UPDATE_CART',
  UPDATE_DISCOUNT = 'UPDATE_DISCOUNT',
  UPDATE_BUYER_IDENTITY = 'UPDATE_BUYER_IDENTITY',
}
export type CartActions = keyof typeof CartAction;
