import { z } from "zod";
import { body, handler, json, mutationUser } from "@/lib/api";
import { hideRecommendation } from "@/lib/recommend";

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId } = await body(req, z.object({ placeId: z.string().min(1).max(64) }));
  await hideRecommendation(user.id, placeId);
  return json({ ok: true });
});
