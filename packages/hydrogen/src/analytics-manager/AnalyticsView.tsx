import { useLocation } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { type ShopAnalytic, type AnalyticsProviderProps, useAnalytics} from "./AnalyticsProvider";
import { CartReturn } from "../cart/queries/cart-types";
import {AnalyticsEvent} from './events';
import { Product, ProductVariant } from "@shopify/hydrogen-react/storefront-api-types";

export type OtherData = {
  [key: string]: unknown;
};

export type BasePayload = {
  eventTimestamp: number;
  shop: ShopAnalytic | null;
  customData: AnalyticsProviderProps['customData'];
};

// Event payloads
export type CollectionViewPayload = {
  collection: {
    id: string;
  };
} & BasePayload;

export type ProductViewPayload = {
  products: Array<{
    id: Product['id']
    title: Product['title'],
    price: ProductVariant['price']['amount'],
    vendor: Product['vendor'],
    variantId: ProductVariant['id'],
    variantTitle: ProductVariant['title'],
    quantity: number,
    sku?: ProductVariant['sku'],
    productType?: Product['productType'],
    [key: string]: unknown,
  }>,
} & BasePayload;

export type CartViewPayload = {
  cart: CartReturn | null;
  prevCart: CartReturn | null;
} & BasePayload;

export type PageViewPayload = {
  url: string;
  cart: CartReturn | null;
  prevCart: CartReturn | null;
} & BasePayload;

export type CartUpdatePayload = {
  cart: CartReturn | null;
  prevCart: CartReturn | null;
} & BasePayload;

export type CustomEventPayload = {
  [key: string]: unknown;
} & BasePayload;

export type EventPayloads = PageViewPayload |
  ProductViewPayload |
  CollectionViewPayload |
  CartViewPayload |
  CartUpdatePayload |
  CustomEventPayload;

export type EventTypes = typeof AnalyticsEvent['PAGE_VIEWED'] |
  typeof AnalyticsEvent['PRODUCT_VIEWED'] |
  typeof AnalyticsEvent['COLLECTION_VIEWED'] |
  typeof AnalyticsEvent['CART_VIEWED'] |
  typeof AnalyticsEvent['CART_UPDATED'] |
  typeof AnalyticsEvent['CUSTOM_EVENT'];

type BaseViewProps = {
  customData?: OtherData;
}

// Event types
type PageViewProps = BaseViewProps & {
  type: typeof AnalyticsEvent.PAGE_VIEWED;
  data?: OtherData;
};

type ProductViewProps = BaseViewProps & {
  type: typeof AnalyticsEvent.PRODUCT_VIEWED;
  data: ProductViewPayload
};

type CollectionViewProps = BaseViewProps & {
  type: typeof AnalyticsEvent.COLLECTION_VIEWED;
  data: CollectionViewPayload;
}

type CartViewProps = BaseViewProps & {
  type: typeof AnalyticsEvent.CART_VIEWED;
  data?: CartViewPayload;
};

type CustomViewProps = BaseViewProps & {
  type: typeof AnalyticsEvent.CUSTOM_EVENT;
  data?: OtherData;
};

function AnalyticsView(props: PageViewProps): null;
function AnalyticsView(props: ProductViewProps): null;
function AnalyticsView(props: CollectionViewProps): null;
function AnalyticsView(props: CartViewProps): null;
function AnalyticsView(props: CustomViewProps): null;
function AnalyticsView(props: any) {
  const {type, payload = {}} = props;
  const location = useLocation();
  const lastLocationPathname = useRef<string>('');
  const {publish, cart, prevCart, shop} = useAnalytics();
  const url = location.pathname + location.search;

  // Publish page_viewed events when the URL changes
  useEffect(() => {
    if (lastLocationPathname.current === url) return;

    // don't publish the event until we have the shop
    if (!shop) return;

    const viewPayload: PageViewPayload = {
      ...payload,
      url: window.location.href,
      cart,
      prevCart,
      shop,
    };

    lastLocationPathname.current = url;

    publish(type, viewPayload);
  }, [publish, url, cart, prevCart, shop]);

  return null;
}

export function AnalyticsPageView(props: Omit<PageViewProps, 'type'>) {
  return <AnalyticsView {...props} type='page_viewed'  />;
}

export function AnalyticsProductView(props: Omit<ProductViewProps, 'type'>) {
  return <AnalyticsView {...props} type='product_viewed'  />;
}

export function AnalyticsCollectionView(props: Omit<CollectionViewProps, 'type'>) {
  return <AnalyticsView {...props} type='collection_viewed'  />;
}

export function AnalyticsCartView(props: Omit<CartViewProps, 'type'>) {
  return <AnalyticsView {...props} type='cart_viewed'  />;
}

export function AnalyticsCustomView(props: CustomViewProps) {
  return <AnalyticsView {...props}  />;
}

// TODO: Search view?