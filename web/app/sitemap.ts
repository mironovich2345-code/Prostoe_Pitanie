import type { MetadataRoute } from 'next';
import { EXPERTS } from '@/data/experts';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://eatlyy.ru').replace(/\/$/, '');
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`,         lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${siteUrl}/clients`,  lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/experts`,  lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/trainers`, lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${siteUrl}/legal`,    lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/support`,  lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const expertRoutes: MetadataRoute.Sitemap = EXPERTS.map((e) => ({
    url: `${siteUrl}/trainers/${e.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...expertRoutes];
}
