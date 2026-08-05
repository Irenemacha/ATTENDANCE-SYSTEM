import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://attendance-dashboard.up.railway.app";
  return [
    { url: base, lastModified: new Date(), priority: 1 },
    { url: `${base}/login`, lastModified: new Date(), priority: 0.8 },
  ];
}
