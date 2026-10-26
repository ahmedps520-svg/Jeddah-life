import { z } from "zod";
import { handler, HttpError, json, mutationUser } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { saveImage } from "@/lib/uploads";

const Folder = z.enum(["reviews", "submissions", "avatars", "places", "events"]);

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const form = await req.formData();
  const folder = Folder.parse(form.get("folder"));
  if ((folder === "places" || folder === "events") && user.role !== "admin") throw new HttpError(403, "forbidden");
  if (!(await rateLimit(`upload:${user.id}`, 30, 3600))) throw new HttpError(429, "rate_limited");
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "missing_file");
  const saved = await saveImage(file, folder, folder === "avatars" ? 512 : 1600);
  return json(saved);
});
