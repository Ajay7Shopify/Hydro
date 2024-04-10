import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs';

const data: ReferenceEntityTemplateSchema = {
  name: 'UNSTABLE_Analytics.Provider',
  category: 'components',
  subCategory: 'analytics',
  isVisualComponent: false,
  related: [],
  description:
    'Provides a context for tracking page views and cart events to send as analytics data to Shopify. This component is integrated with the Customer Privacy API for consent management. The provider can also be used to connect third-party analytics services through its subscribe and publish system. The [`unstable_useAnalytics`](/docs/api/hydrogen/2024-04/hooks/unstable_useanalytics) hook provides access to the analytics provider context.',
  type: 'component',
  defaultExample: {
    description: 'This is the default example',
    codeblock: {
      tabs: [
        {
          title: 'JavaScript',
          code: './AnalyticsProvider.example.jsx',
          language: 'js',
        },
        {
          title: 'TypeScript',
          code: './AnalyticsProvider.example.tsx',
          language: 'ts',
        },
      ],
      title: 'example',
    },
  },
  definitions: [
    {
      title: 'Props',
      type: 'AnalyticsProviderProps',
      description: '',
    },
  ],
};

export default data;
