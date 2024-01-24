import type {
  ClientReturn,
  ClientVariablesInRestParams,
} from '@shopify/hydrogen-codegen';

import type {CrossRuntimeRequest} from '../utils/request';

import type {HydrogenSession} from '../hydrogen';

// Return type of unauthorizedHandler = Return type of loader/action function
// This type is not exported https://github.com/remix-run/react-router/blob/main/packages/router/utils.ts#L167
type DataFunctionValue = Response | NonNullable<unknown> | null;

type CustomerAPIResponse<ReturnType> = {
  data: ReturnType;
  errors: Array<{
    message: string;
    locations?: Array<{line: number; column: number}>;
    path?: Array<string>;
    extensions: {code: string};
  }>;
  extensions: {
    cost: {
      requestQueryCost: number;
      actualQueryCakes: number;
      throttleStatus: {
        maximumAvailable: number;
        currentAvailable: number;
        restoreRate: number;
      };
    };
  };
};

export interface CustomerAccountQueries {
  // Example of how a generated query type looks like:
  // '#graphql query q1 {...}': {return: Q1Query; variables: Q1QueryVariables};
}

export interface CustomerAccountMutations {
  // Example of how a generated mutation type looks like:
  // '#graphql mutation m1 {...}': {return: M1Mutation; variables: M1MutationVariables};
}

export type CustomerClient = {
  /** Start the OAuth login flow. This function should be called and returned from a Remix action. It redirects the user to a login domain. An optional `redirectPath` parameter defines the final path the user lands on at the end of the oAuth flow. The default redirectPath is the page that ran handleUnauthorized, query or mutate with unauthorized customer, then `/account`. */
  login: (redirectPath?: string) => Promise<Response>;
  /** On successful login, the user redirects back to your app. This function validates the OAuth response and exchanges the authorization code for an access token and refresh token. It also persists the tokens on your session. This function should be called and returned from the Remix loader configured as the redirect URI within the Customer Account API settings. */
  authorize: () => Promise<Response>;
  /** Returns if the user is logged in. It also checks if the access token is expired and refreshes it if needed. */
  isLoggedIn: () => Promise<boolean>;
  /** Check for unauthorized customer and perform `unauthorizedHandler`. */
  handleUnauthorized: () => void | DataFunctionValue;
  /** Returns CustomerAccessToken if the user is logged in. It also run a expirey check and does a token refresh if needed. */
  getAccessToken: () => Promise<string | undefined>;
  /** Logout the user by clearing the session and redirecting to the login domain. It should be called and returned from a Remix action. */
  logout: () => Promise<Response>;
  /** Execute a GraphQL query against the Customer Account API. Usually you should first check if the user is logged in before querying the API. */
  query: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountQueries,
      RawGqlString
    >
  ) => Promise<
    CustomerAPIResponse<
      ClientReturn<CustomerAccountQueries, RawGqlString, OverrideReturnType>
    >
  >;
  /** Execute a GraphQL mutation against the Customer Account API. Usually you should first check if the user is logged in before querying the API. */
  mutate: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountMutations,
      RawGqlString
    >
  ) => Promise<
    CustomerAPIResponse<
      ClientReturn<CustomerAccountMutations, RawGqlString, OverrideReturnType>
    >
  >;
};

export type CustomerClientOptions = {
  /** The client requires a session to persist the auth and refresh token. By default Hydrogen ships with cookie session storage, but you can use [another session storage](https://remix.run/docs/en/main/utils/sessions) implementation.  */
  session: HydrogenSession;
  /** Unique UUID prefixed with `shp_` associated with the application, this should be visible in the customer account api settings in the Hydrogen admin channel. Mock.shop doesn't automatically supply customerAccountId. Use `h2 env pull` to link your store credentials. */
  customerAccountId: string;
  /** The account URL associated with the application, this should be visible in the customer account api settings in the Hydrogen admin channel. Mock.shop doesn't automatically supply customerAccountUrl. Use `h2 env pull` to link your store credentials. */
  customerAccountUrl: string;
  /** Override the version of the API */
  customerApiVersion?: string;
  /** The object for the current Request. It should be provided by your platform. */
  request: CrossRuntimeRequest;
  /** The waitUntil function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: ExecutionContext['waitUntil'];
  /** This is the route in your app that authorizes the user after logging in. Make sure to call `customer.authorize()` within the loader on this route. It defaults to `/account/authorize`. */
  authUrl?: string;
  /** The behaviour when handleUnauthorized, query or mutate is called with an unauthorized customer. The return of method will be throw. The default behaviour is redirecting to `/account/login` where login() is located and pass in current path as redirectPath. */
  unauthorizedHandler?: () => DataFunctionValue;
};

/** Below are types meant for documentation only. Ensure it stay in sycn with the type above. */

export type CustomerClientForDocs = {
  /** Start the OAuth login flow. This function should be called and returned from a Remix action. It redirects the user to a login domain. An optional `redirectPath` parameter defines the final path the user lands on at the end of the oAuth flow. The default redirectPath is the page that ran handleUnauthorized, query or mutate with unauthorized customer, then `/account`. */
  login?: (redirectPath?: string) => Promise<Response>;
  /** On successful login, the user redirects back to your app. This function validates the OAuth response and exchanges the authorization code for an access token and refresh token. It also persists the tokens on your session. This function should be called and returned from the Remix loader configured as the redirect URI within the Customer Account API settings. */
  authorize?: () => Promise<Response>;
  /** Returns if the user is logged in. It also checks if the access token is expired and refreshes it if needed. */
  isLoggedIn?: () => Promise<boolean>;
  /** Check for unauthorized customer and perform `unauthorizedHandler`. */
  handleUnauthorized: () => void | DataFunctionValue;
  /** Returns CustomerAccessToken if the user is logged in. It also run a expirey check and does a token refresh if needed. */
  getAccessToken?: () => Promise<string | undefined>;
  /** Logout the user by clearing the session and redirecting to the login domain. It should be called and returned from a Remix action. */
  logout?: () => Promise<Response>;
  /** Execute a GraphQL query against the Customer Account API. Usually you should first check if the user is logged in before querying the API. */
  query?: <TData = any>(
    query: string,
    options: CustomerClientQueryOptionsForDocs,
  ) => Promise<TData>;
  /** Execute a GraphQL mutation against the Customer Account API. Usually you should first check if the user is logged in before querying the API. */
  mutate?: <TData = any>(
    mutation: string,
    options: CustomerClientQueryOptionsForDocs,
  ) => Promise<TData>;
};

export type CustomerClientQueryOptionsForDocs = {
  /** The variables for the GraphQL statement. */
  variables?: Record<string, unknown>;
};
