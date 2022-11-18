import {createRequestHandler, proxyLiquidRoute} from '@shopify/hydrogen-remix';
// The build remix app provided by remix build
import * as remixBuild from 'remix-build';
import {getLocaleFromRequest} from '~/lib/utils';
import {HydrogenSession} from '~/lib/session.server';

declare const process: {env: {NODE_ENV: string}};

const requestHandler = createRequestHandler({
  build: remixBuild,
  mode: process.env.NODE_ENV,
  shouldProxyAsset: () => false,
});

const storefrontConfig = {
  publicStorefrontToken: '3b580e70970c4528da70c98e097c2fa0',
  storeDomain: 'hydrogen-preview',
  storefrontApiVersion: '2023-01',
};

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): Promise<Response> {
    if (!env?.SESSION_SECRET) {
      // eslint-disable-next-line no-console
      console.error('SESSION_SECRET environment variable is not set');
      return new Response('Internal Server Error', {status: 500});
    }

    const session = await HydrogenSession.init(request, [env.SESSION_SECRET]);

    if (new URL(request.url).pathname === '/proxy') {
      return await proxyLiquidRoute(
        request,
        storefrontConfig.storeDomain,
        '/pages/about',
      );
    }

    try {
      return await requestHandler(
        request,
        {
          env,
          context,
          storefront: {
            publicStorefrontToken: env.SHOPIFY_STOREFRONT_API_PUBLIC_TOKEN,
            storeDomain: env.SHOPIFY_STORE_DOMAIN,
            storefrontApiVersion: '2022-10',
            i18n: getLocaleFromRequest(request),
          },
        },
        {
          session,
        },
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
