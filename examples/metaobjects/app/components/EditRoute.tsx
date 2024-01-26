import {useState, useEffect} from 'react';
import {Link} from '@remix-run/react';

/**
 * Displays an `Edit Route` button in the top right corner of the page
 * This button opens a new tab that let's you easily edit the metaobject entry in the Shopify Admin
 * This is only display when in development or when in preview branch deployment
 */
export function EditRoute({routeId}: {routeId: string}) {
  const [url, setUrl] = useState<URL | null>(null);
  const storeSubdomain = 'hydrogen-lab';

  useEffect(() => {
    setUrl(new URL(window.location.href));
  }, []);

  if (!url) return null;

  const isDev =
    url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1');
  const isPreview = url.hostname.includes('preview');
  const legacyId = routeId.split('/').pop();
  const adminUrl = `https://admin.shopify.com/store/${storeSubdomain}/content/entries/route/${legacyId}`;

  const shouldShowEditLink = isDev || isPreview;
  if (!shouldShowEditLink) return null;

  return (
    <Link
      to={adminUrl}
      target="_blank"
      style={{
        position: 'absolute',
        top: '5rem',
        right: '3rem',
        padding: '0.5rem',
        backgroundColor: 'black',
        color: 'white',
        zIndex: 100,
      }}
    >
      Edit Route
    </Link>
  );
}
