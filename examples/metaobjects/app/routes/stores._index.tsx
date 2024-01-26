import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from '@remix-run/react';

// 1. Add metaobject content imports
import {ROUTE_CONTENT_QUERY, RouteContent} from '~/sections/RouteContent';

export const meta: MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;

  // 2. Query for the route's content metaobject
  const {route} = await storefront.query(ROUTE_CONTENT_QUERY, {
    variables: {handle: 'route-stores'},
    cache: storefront.CacheNone(),
  });

  return json({route});
}

export default function Stores() {
  const {route} = useLoaderData<typeof loader>();

  return (
    <div className="stores">
      {/* 3. Render the route's content sections */}
      <RouteContent route={route} />
    </div>
  );
}
