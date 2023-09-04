import {hashKey} from '../utils/hash.js';
import {CacheShort, CachingStrategy, NO_STORE} from './strategies';
import {
  getItemFromCache,
  setItemInCache,
  isStale,
  getKeyUrl,
} from './sub-request';

/**
 * The cache key is used to uniquely identify a value in the cache.
 */
export type CacheKey = string | readonly unknown[];

export type WithCacheOptions<T = unknown> = {
  strategy?: CachingStrategy | null;
  cacheInstance?: Cache;
  shouldCacheResult?: (value: T) => boolean;
  waitUntil?: ExecutionContext['waitUntil'];
};

export type FetchCacheOptions = {
  cache?: CachingStrategy;
  cacheInstance?: Cache;
  cacheKey?: CacheKey;
  shouldCacheResponse?: (body: any, response: Response) => boolean;
  waitUntil?: ExecutionContext['waitUntil'];
  returnType?: 'json' | 'text' | 'arrayBuffer' | 'blob';
};

function toSerializableResponse(body: any, response: Response) {
  return [
    body,
    {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    },
  ] satisfies [any, ResponseInit];
}

function fromSerializableResponse([body, init]: [any, ResponseInit]) {
  return [body, new Response(body, init)] as const;
}

// Check if the response body has GraphQL errors
// https://spec.graphql.org/June2018/#sec-Response-Format
export const checkGraphQLErrors = (body: any) => !body?.errors;

declare global {
  var __H2_LOG_SUBREQUEST_EVENT: (args: unknown) => Promise<any>;
}

// Lock to prevent revalidating the same sub-request
// in the same isolate. Note that different isolates
// in the same colo could duplicate the revalidation
// since this is only an in-memory lock.
// https://github.com/Shopify/oxygen-platform/issues/625
const swrLock = new Set<string>();

export async function runWithCache<T = unknown>(
  cacheKey: CacheKey,
  actionFn: () => T | Promise<T>,
  {
    strategy = CacheShort(),
    cacheInstance,
    shouldCacheResult = () => true,
    waitUntil,
  }: WithCacheOptions<T>,
): Promise<T> {
  if (!cacheInstance || !strategy || strategy.mode === NO_STORE) {
    return actionFn();
  }

  const key = hashKey([
    // '__HYDROGEN_CACHE_ID__', // TODO purgeQueryCacheOnBuild
    ...(typeof cacheKey === 'string' ? [cacheKey] : cacheKey),
  ]);

  const startTime = Date.now();
  const cachedItem = await getItemFromCache(cacheInstance, key);
  // console.log('--- Cache', cachedItem ? 'HIT' : 'MISS');

  const logSubRequestEvent =
    process.env.NODE_ENV === 'development'
      ? (cacheStatus: 'MISS' | 'HIT' | 'STALE') => {
          const promise = globalThis.__H2_LOG_SUBREQUEST_EVENT?.(
            new Request(getKeyUrl(key), {
              headers: {
                'hydrogen-start-time': startTime.toString(),
                'hydrogen-end-time': Date.now().toString(),
                'hydrogen-cache-status': cacheStatus,
              },
            }),
          );

          promise && waitUntil?.(promise);
        }
      : undefined;

  if (cachedItem) {
    const [cachedResult, cacheInfo] = cachedItem;
    const cacheStatus = isStale(key, cacheInfo) ? 'STALE' : 'HIT';

    if (!swrLock.has(key) && cacheStatus === 'STALE') {
      swrLock.add(key);

      // Important: Run revalidation asynchronously.
      const revalidatingPromise = Promise.resolve().then(async () => {
        try {
          const result = await actionFn();

          if (shouldCacheResult(result)) {
            await setItemInCache(cacheInstance, key, result, strategy);
          }
        } catch (error: any) {
          if (error.message) {
            error.message = 'SWR in sub-request failed: ' + error.message;
          }

          console.error(error);
        } finally {
          swrLock.delete(key);
        }
      });

      // Asynchronously wait for it in workers
      waitUntil?.(revalidatingPromise);
    }

    logSubRequestEvent?.(cacheStatus);

    return cachedResult;
  }

  const result = await actionFn();

  logSubRequestEvent?.('MISS');

  /**
   * Important: Do this async
   */
  if (shouldCacheResult(result)) {
    const setItemInCachePromise = setItemInCache(
      cacheInstance,
      key,
      result,
      strategy,
    );

    waitUntil?.(setItemInCachePromise);
  }

  return result;
}

/**
 * `fetch` equivalent that stores responses in cache.
 * Useful for calling third-party APIs that need to be cached.
 * @private
 */
export async function fetchWithServerCache(
  url: string,
  requestInit: Request | RequestInit,
  {
    cacheInstance,
    cache: cacheOptions,
    cacheKey = [url, requestInit],
    shouldCacheResponse = () => true,
    waitUntil,
    returnType = 'json',
  }: FetchCacheOptions = {},
): Promise<readonly [any, Response]> {
  if (!cacheOptions && (!requestInit.method || requestInit.method === 'GET')) {
    cacheOptions = CacheShort();
  }

  return runWithCache(
    cacheKey,
    async () => {
      const response = await fetch(url, requestInit);
      let data;

      try {
        data = await response[returnType]();
      } catch {
        try {
          data = await response.text();
        } catch {
          // Getting a response without a valid body
          throw new Error(
            `Storefront API response code: ${
              response.status
            } (Request Id: ${response.headers.get('x-request-id')})`,
          );
        }
      }

      return toSerializableResponse(data, response);
    },
    {
      cacheInstance,
      waitUntil,
      strategy: cacheOptions ?? null,
      shouldCacheResult: (result) =>
        shouldCacheResponse(...fromSerializableResponse(result)),
    },
  ).then(fromSerializableResponse);
}
