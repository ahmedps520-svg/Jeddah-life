import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { body, handler, json, mutationUser } from "@/lib/api";
import { generateDueReminders, markAllRead, markRead, unreadCount } from "@/lib/notifications";

/** Unread count for the header bell. Also creates any reminders that have become due. */
export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ unread: 0 });
  await generateDueReminders(user.id);
  return json({ unread: await unreadCount(user.id) });
});

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(req, z.object({ id: z.string().max(64).optional() }));
  if (data.id) await markRead(user.id, data.id);
  else await markAllRead(user.id);
  return json({ ok: true, unread: await unreadCount(user.id) });
});
