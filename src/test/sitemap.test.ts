import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { sitemapStaticPaths, sitemapXML } from "@/lib/sitemap";

const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
const paths = sitemapStaticPaths(router);

describe("Sitemap", () => {
  it("lists the public pages the site advertises", () => {
    expect(paths).toEqual(["/", "/about", "/contact"]);
  });

  it("keeps account pages out of the sitemap", () => {
    expect(paths).not.toContain("/auth");
    expect(paths).not.toContain("/reset-password");
    expect(paths).not.toContain("/api/transcribe");
  });

  it("writes absolute URLs for the public origin without invented timestamps", () => {
    const xml = sitemapXML("https://stopviolence.lovable.app", paths.map((path) => ({ path })));
    expect(xml).toContain("<loc>https://stopviolence.lovable.app/</loc>");
    expect(xml).toContain("<loc>https://stopviolence.lovable.app/about</loc>");
    expect(xml).toContain("<loc>https://stopviolence.lovable.app/contact</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("points crawlers at the sitemap from robots.txt", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).toContain("Sitemap: https://stopviolence.lovable.app/sitemap.xml");
  });
});
