"use client";

import { usePathname } from "next/navigation";

/** Hides its children on full-screen routes such as the map. */
export function HideOn({ paths, children }: { paths: string[]; children: React.ReactNode }) {
  const rest = usePathname().replace(/^\/(en|ar)/, "") || "/";
  if (paths.some((p) => rest.startsWith(p))) return null;
  return <>{children}</>;
}
