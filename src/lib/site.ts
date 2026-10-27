/** Public base URL for absolute links (sitemap, share links). Set SITE_URL in production. */
export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
