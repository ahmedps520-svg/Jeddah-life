import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal, shared-by-link and admin pages stay out of search engines.
      disallow: ["/api/", "/uploads/", "/*/admin", "/*/saved", "/*/profile", "/*/notifications", "/*/together/", "/*/c/", "/*/o/", "/*/auth/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
