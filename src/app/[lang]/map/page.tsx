import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { parseExploreParams } from "@/lib/search/params";
import { MapExplorer } from "@/components/map/map-explorer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.map.title };
}

export default async function MapPage({ searchParams }: PageProps<"/[lang]/map">) {
  const s = parseExploreParams(await searchParams);
  return (
    <MapExplorer
      initial={{
        q: s.q,
        cat: s.cat,
        area: s.area,
        max: s.max,
        free: s.free,
        open: s.open,
        rating: s.rating,
        dist: s.dist,
        attrs: s.attrs,
        hideChains: s.hideChains,
        verified: s.verified,
      }}
    />
  );
}
