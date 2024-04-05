import {useLoadScript} from '@shopify/hydrogen-react';
import {useEffect, useRef} from 'react';

export type ConsentStatus = 'true' | 'false' | '';

export type VisitorConsent = {
  marketing: ConsentStatus;
  analytics: ConsentStatus;
  preferences: ConsentStatus;
  sale_of_data: ConsentStatus;
};

export type VisitorConsentCollected = {
  analyticsAllowed: boolean;
  firstPartyMarketingAllowed: boolean;
  marketingAllowed: boolean;
  preferencesAllowed: boolean;
  saleOfDataAllowed: boolean;
  thirdPartyMarketingAllowed: boolean;
};

export type CustomerPrivacyApiLoaded = boolean;

export type CustomerPrivacyConsentConfig = {
  checkoutRootDomain?: string;
  storefrontRootDomain?: string;
  storefrontAccessToken?: string;
};

export type SetConsentHeadlessParams = VisitorConsent &
  CustomerPrivacyConsentConfig & {
    headlessStorefront?: boolean;
  };

/**
  Ideally this type should come from the Custoemr Privacy API sdk
  analyticsProcessingAllowed -
  currentVisitorConsent
  doesMerchantSupportGranularConsent
  firstPartyMarketingAllowed
  getCCPAConsent
  getRegulation
  getShopPrefs
  getTrackingConsent
  isRegulationEnforced
  marketingAllowed
  preferencesProcessingAllowed
  saleOfDataAllowed
  saleOfDataRegion
  setCCPAConsent
  setTrackingConsent
  shouldShowBanner
  shouldShowCCPABanner
  shouldShowGDPRBanner
  thirdPartyMarketingAllowed
**/
export type CustomerPrivacy = {
  currentVisitorConsent: () => VisitorConsent;
  userCanBeTracked: () => boolean;
  saleOfDataAllowed: () => boolean;
  marketingAllowed: () => boolean;
  analyticsProcessingAllowed: () => boolean;
  setTrackingConsent: (
    consent: SetConsentHeadlessParams,
    callback: () => void,
  ) => void;
};

export type PrivacyBanner = {
  loadBanner: (options: CustomerPrivacyConsentConfig) => void;
};

export interface CustomEventMap {
  visitorConsentCollected: CustomEvent<VisitorConsentCollected>;
  customerPrivacyApiLoaded: CustomEvent<CustomerPrivacyApiLoaded>;
}

export type CustomerPrivacyApiProps = {
  /** The production shop checkout domain url.  */
  checkoutDomain: string;
  /** The storefront access token for the shop. */
  storefrontAccessToken: string;
  /** Whether to load the Shopify privacy banner as configured in Shopify admin. Defaults to true. */
  withPrivacyBanner?: boolean;
  /** Callback to be called when visitor consent is collected. */
  onVisitorConsentCollected?: (consent: VisitorConsentCollected) => void;
};

const CONSENT_API =
  'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.1/consent-tracking-api.js';
const CONSENT_API_WITH_BANNER =
  'https://cdn.shopify.com/shopifycloud/privacy-banner/storefront-banner.js';

function logMissingConfig(fieldName: string) {
  // eslint-disable-next-line no-console
  console.error(
    `Unable to setup Customer Privacy API: Missing consent.${fieldName} consent configuration.`,
  );
}

export function useCustomerPrivacy(props: CustomerPrivacyApiProps) {
  const {
    withPrivacyBanner = true,
    onVisitorConsentCollected,
    ...consentConfig
  } = props;
  const loadedEvent = useRef(false);
  const scriptStatus = useLoadScript(
    withPrivacyBanner ? CONSENT_API_WITH_BANNER : CONSENT_API,
    {
      attributes: {
        id: 'customer-privacy-api',
      },
    },
  );

  if (!consentConfig.checkoutDomain) logMissingConfig('checkoutDomain');
  if (!consentConfig.storefrontAccessToken)
    logMissingConfig('storefrontAccessToken');

  useEffect(() => {
    const consentCollectedHandler = (
      event: CustomEvent<VisitorConsentCollected>,
    ) => {
      if (onVisitorConsentCollected) {
        onVisitorConsentCollected(event.detail);
      }
    };

    document.addEventListener(
      'visitorConsentCollected',
      consentCollectedHandler,
    );

    return () => {
      document.removeEventListener(
        'visitorConsentCollected',
        consentCollectedHandler,
      );
    };
  }, [onVisitorConsentCollected]);

  useEffect(() => {
    if (scriptStatus !== 'done' || loadedEvent.current) return;

    loadedEvent.current = true;

    if (withPrivacyBanner && window?.privacyBanner) {
      window?.privacyBanner?.loadBanner({
        checkoutRootDomain: consentConfig.checkoutDomain,
        storefrontAccessToken: consentConfig.storefrontAccessToken,
      });
    }

    // Override the setTrackingConsent method to include the headless storefront configuration
    if (window.Shopify?.customerPrivacy) {
      const originalSetTrackingConsent =
        window.Shopify.customerPrivacy.setTrackingConsent;
      window.Shopify.customerPrivacy.setTrackingConsent = (
        consent: VisitorConsent,
        callback: () => void,
      ) => {
        originalSetTrackingConsent(
          {
            ...consent,
            headlessStorefront: true,
            checkoutRootDomain: consentConfig.checkoutDomain,
            storefrontAccessToken: consentConfig.storefrontAccessToken,
          },
          callback,
        );
      };
    }
  }, [scriptStatus, withPrivacyBanner, consentConfig]);

  return;
}

export function getCustomerPrivacy() {
  try {
    return window.Shopify && window.Shopify.customerPrivacy
      ? window.Shopify?.customerPrivacy
      : null;
  } catch (e) {
    return null;
  }
}

export function getCustomerPrivacyRequired() {
  const customerPrivacy = getCustomerPrivacy();

  if (!customerPrivacy) {
    throw new Error(
      'Shopify Customer Privacy API not available. Must be used within a useEffect. Make sure to load the Shopify Customer Privacy API with useCustomerPrivacy() or <AnalyticsProvider>.',
    );
  }

  return customerPrivacy;
}
