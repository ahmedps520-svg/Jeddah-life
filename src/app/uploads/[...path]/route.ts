import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";

/** Serves user and admin uploads from UPLOAD_DIR (WebP only, no directory traversal). */
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!/^(reviews|submissions|avatars|places|events)\/[A-Za-z0-9_-]+\.webp$/.test(rel)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, rel));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
