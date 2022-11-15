# Routing

_Date: Nov 7, 2022_

---

Hydrogen will provide built-in support for Shopify routes to make it easier to build a custom storefront.

See [H2 Multiple Storefronts & Routing Problems](https://docs.google.com/document/d/1v0qV3wqAl3wsYvVmJhqBXAqHTX9JdSLjBJ75FJnyW0M/edit#) for a detailed motiviation.

## Built-in Routes

Hydrogen comes with built-in routes automatically available. These are defined with a custom route function within `remix.config.js`:

```ts
import {hydrogenRoutes} from '@shopify/hydrogen';

module.exports = {
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      hydrogenRoutes(route, {});
    });
  },
};
```

Some of the built in routes are specific to the framework, and include:

1. `/__health` - used by Oxygen to verify the health of the application
1. `/routeManifest.json` - Manifest describing all available routes in the Hydrogen app. See below for more details.
1. `/graphiql` - Dev-mode UI for querying GraphQL

Other routes are specific to Shopify, and include:

1. `/discounts/DISCOUNT?redirect-to=/redirect/path/name` - Apply discount by a link:
1. `/cart/:variantID:quantity,anotherVariantId:quantity` - Checkout link

Only the Shopify specific routes can be disabled with an option:

```ts
import {hydrogenRoutes} from '@shopify/hydrogen';

module.exports = {
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      hydrogenRoutes(route, {
        includeDiscounts: false,
        includeCart: false,
      });
    });
  },
};
```

## Backlink Redirects

Merchants migrating onto Hydrogen may not be aware of all the existing routes within the Online Store. We make it easy to automatically redirect online store routes to new custom routes within Hydrogen. This can also be disabled by an option:

```ts
import {hydrogenRoutes} from '@shopify/hydrogen';

module.exports = {
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      hydrogenRoutes(route, {
        onlineStoreRedirects: true,
      });
    });
  },
};
```

## Custom redirects

The merchant may define custom redirects within the admin. Optionally Hydrogen can automatically route those custom redirects:

```ts
import {hydrogenRoutes} from '@shopify/hydrogen';

module.exports = {
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      hydrogenRoutes(route, {
        customRedirects: true,
      });
    });
  },
};
```

## Online-store Proxying

It is easy to migrate from the online store to a Hydrogen custom storefront. Hydrogen can host some routes while proxying other routes to the online store. All URLs that match the provided pattern(s) are proxied to the online store:

```ts
import {hydrogenRoutes} from '@shopify/hydrogen';

module.exports = {
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      hydrogenRoutes(route, {
        proxy: [.+/products\/.+/],
      });
    });
  },
};
```

## Deterministic routes

Routes in Hydrogen can be defined in completely custom ways. Other services need to understand how to link to Shopify entities within a custom storefront. For example, products might exist on `/productos/:handle` instead of `/products/:handle`.

The `/routes/productos/$handle.tsx` file should include `handle` meta-data that describes this route as a `PRODUCT` route:

```ts
import {RESOURCE_TYPES} from '@shopify/hydrogen';

export const handle = {
  hydrogen: {
    resourceType: RESOURCE_TYPES.PRODUCT,
  },
};

export default function Productos() {
  /*...*/
}
```

The available resource types are:

| **Resource Type** | **Description**           |
| ----------------- | ------------------------- |
| BLOG              | `/blogs`                  |
| ARTICLE           | `/blogs/:handle/articles` |
| CATALOG           | `/products`               |
| COLLECTION        | `/collections/:handle`    |
| COLLECTIONS       | `/collections`            |
| FRONTPAGE         | `/`                       |
| PAGE              | `/pages/:handle`          |
| PRODUCT           | `/products/:products`     |
| SEARCH            | `/search/?q=…`            |
| SHOP_POLICY       | `/policies`               |

Notes:

1. There can only be _one_ route defined of each resource type. An exception is thrown when multiple routes are found of the same resource type.
1. We can warn the developer during dev mode when routes don't exist for a specific resource type.
1. We can warn the developer during dev mode when we know a specific route doesn't meet SEO, Analytics, or other requirements.

## Route manifest

A built-in resource route is available that contains a manifest of all routes defined within the Hydrogen app. All routes of a given resource type are within the `resourceRoutes` property. All other routes are defined within the `customRoutes` property:

```ts
{
  resourceRoutes: [
    {
      type: 'BLOG',
      pathname: '/blogs/:handle',
    },
    {
      type: 'ARTICLE',
      pathname: '/blogs/:handle/articles/:handle',
    },
    {
      type: 'COLLECTION',
      pathname: '/collections/:handle',
    },
    {
      type: 'PRODUCT',
      pathname: '/products/:handle',
    }
  ],
  customRoutes: [
    {
      pathname: '/about',
    }
  ]
}
```

## Future

Though not priority for the initial Hydrogen release, there are other routing features we can add down the road:

### CLI

The CLI could scaffold routes of a given resource type:

```
h2 scaffold route products --path "/bundles/:handle"
h2 scaffold route page --path "/about"
h2 setup sentry
h2 setup elevar
```

### Hydrogen `<Link>`

We could also explore a Hydrogen specific `<Link>` component that can calculate the route URL just given the type and necessary parameters:

```ts
<Link to="product" handle="hydrogen">
```

## Questions
