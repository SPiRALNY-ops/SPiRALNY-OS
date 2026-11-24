import type { MetadataRoute } from "next";

/**
 * Spiral OS is private: every page sits behind sign-in and carries `noindex`. Pages stay crawlable on
 * purpose, because a crawler only sees `noindex` on a page robots.txt lets it fetch (Google's
 * "Block Search indexing with noindex" guide). The API has nothing for a crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
