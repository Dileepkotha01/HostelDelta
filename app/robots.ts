import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kupera.in';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/marketing', '/login', '/signup'],
        disallow: ['/app/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
