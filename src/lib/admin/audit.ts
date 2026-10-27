import "server-only";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

/** Records an administrative action. Never throws: auditing must not break the action itself. */
export async function audit(
  userId: string,
  action: string,
  target: { type: string; id: string } | null,
  detail?: string | null,
) {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      detail: detail ? detail.slice(0, 1000) : null,
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

/** Names of keys whose values differ (JSON comparison), for audit details. */
export function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}
