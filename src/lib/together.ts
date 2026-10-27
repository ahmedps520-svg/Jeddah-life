import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { planComments, planOptions, planParticipants, planVotes, sharedPlans, users, type ItineraryStop } from "@/lib/db/schema";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/auth/password";
import { HttpError } from "@/lib/api";
import { notify, type NotificationType } from "@/lib/notifications";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import type { PlannedStop } from "@/lib/planner/engine";
import { evaluate, type Plan } from "@/lib/planner/engine";

/** Room codes avoid look-alike characters (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function newCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_RE.test(c) ? c : null;
}

const guestCookie = (code: string) => `jl_plan_${code}`;
const GUEST_DAYS = 60;

export type PlanRow = typeof sharedPlans.$inferSelect;
export type Participant = typeof planParticipants.$inferSelect;

export async function planByCode(code: string): Promise<PlanRow | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  const [p] = await db.select().from(sharedPlans).where(eq(sharedPlans.code, c));
  return p ?? null;
}

/** The participant making this request: their account, or the guest cookie for this plan. */
export async function currentParticipant(plan: PlanRow, user?: SessionUser | null): Promise<Participant | null> {
  const u = user === undefined ? await getCurrentUser() : user;
  if (u) {
    const [p] = await db
      .select()
      .from(planParticipants)
      .where(and(eq(planParticipants.planId, plan.id), eq(planParticipants.userId, u.id)));
    if (p) return p;
  }
  const token = (await cookies()).get(guestCookie(plan.code))?.value;
  if (!token) return null;
  const [g] = await db
    .select()
    .from(planParticipants)
    .where(and(eq(planParticipants.planId, plan.id), eq(planParticipants.guestTokenHash, sha256(token))));
  return g ?? null;
}

export async function requireParticipant(plan: PlanRow): Promise<Participant> {
  const p = await currentParticipant(plan);
  if (!p) throw new HttpError(403, "not_a_participant");
  return p;
}

export async function setGuestCookie(code: string): Promise<string> {
  const token = randomToken();
  (await cookies()).set(guestCookie(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_DAYS * 24 * 3600,
  });
  return sha256(token);
}

export async function clearGuestCookie(code: string) {
  (await cookies()).delete(guestCookie(code));
}

/** Marks the plan as changed so polling clients pick up the new state. */
export async function bump(planId: string) {
  await db
    .update(sharedPlans)
    .set({ version: sql`${sharedPlans.version} + 1`, updatedAt: new Date() })
    .where(eq(sharedPlans.id, planId));
}

/**
 * Notifies signed-in participants (never the person who acted). Guests have
 * no account to notify; they see changes when they open the plan.
 */
export async function notifyPlan(
  plan: PlanRow,
  actor: Participant,
  type: NotificationType,
  opts: { organizerOnly?: boolean; dedupe?: string } = {},
) {
  const people = await db
    .select({ userId: planParticipants.userId, role: planParticipants.role })
    .from(planParticipants)
    .where(eq(planParticipants.planId, plan.id));
  for (const p of people) {
    if (!p.userId || p.userId === actor.userId) continue;
    if (opts.organizerOnly && p.role !== "organizer") continue;
    await notify(
      p.userId,
      type,
      { code: plan.code, title: plan.title, actor: actor.displayName },
      opts.dedupe ? `${type}:${plan.id}:${p.userId}:${opts.dedupe}` : undefined,
    );
  }
}

export function kindForPlace(p: PlaceLite): PlannedStop["kind"] {
  switch (p.category) {
    case "cafes":
      return "coffee";
    case "restaurants":
      return "meal";
    case "culture":
      return "culture";
    case "outdoors":
    case "beaches":
      return "scenic";
    case "shopping":
      return "shopping";
    default:
      return "activity";
  }
}

/** Date options may carry a time: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". */
export function splitWhen(v: string): { date: string; time: string | null } {
  const [date, time] = v.split("T");
  return { date, time: time ?? null };
}

export function finalPlan(catalog: Catalog, plan: PlanRow, groupSize: number): Plan | null {
  if (plan.status !== "final" || !plan.finalDate || !plan.finalStops?.length) return null;
  const { date, time } = splitWhen(plan.finalDate);
  const stops = plan.finalStops
    .map((s) => ({ s, p: catalog.byId.get(s.placeId) }))
    .filter((x): x is { s: ItineraryStop; p: PlaceLite } => !!x.p)
    .map(({ s, p }) => ({ placeId: p.id, kind: kindForPlace(p), durationMin: s.durationMin }));
  if (!stops.length) return null;
  return evaluate(
    catalog,
    {
      groupType: "custom",
      groupSize: Math.max(1, groupSize),
      budget: plan.budgetPerPerson,
      budgetMode: "per_person",
      interests: [],
      date,
      startTime: time ?? "17:00",
      durationMin: 16 * 60,
      start: null,
      transport: "car",
    },
    stops,
  );
}

export type PlanPlace = Pick<PlaceLite, "id" | "slug" | "nameEn" | "nameAr" | "category" | "sub" | "img" | "cost" | "hood" | "lat" | "lng" | "ver">;

export type PlanState = {
  plan: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    budgetPerPerson: number | null;
    status: "planning" | "final" | "cancelled";
    finalDate: string | null;
    finalTimeGiven: boolean;
    version: number;
    createdAt: number;
  };
  me: { id: string; role: "organizer" | "participant"; displayName: string; isGuest: boolean } | null;
  participants: { id: string; displayName: string; role: "organizer" | "participant"; isGuest: boolean }[];
  options: {
    id: string;
    kind: "place" | "date";
    placeId: string | null;
    date: string | null;
    note: string | null;
    proposedBy: { id: string; name: string };
    votes: { participantId: string; value: number }[];
    score: number;
  }[];
  comments: { id: string; body: string; author: { id: string; name: string }; createdAt: number }[];
  places: Record<string, PlanPlace>;
  final: Plan | null;
};

function lite(p: PlaceLite): PlanPlace {
  return { id: p.id, slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr, category: p.category, sub: p.sub, img: p.img, cost: p.cost, hood: p.hood, lat: p.lat, lng: p.lng, ver: p.ver };
}

export async function planState(catalog: Catalog, plan: PlanRow, me: Participant | null): Promise<PlanState> {
  const [people, opts, comments] = await Promise.all([
    db.select().from(planParticipants).where(eq(planParticipants.planId, plan.id)).orderBy(asc(planParticipants.joinedAt)),
    db.select().from(planOptions).where(eq(planOptions.planId, plan.id)).orderBy(asc(planOptions.createdAt)),
    db.select().from(planComments).where(eq(planComments.planId, plan.id)).orderBy(asc(planComments.createdAt)),
  ]);
  const votes = opts.length
    ? await db
        .select()
        .from(planVotes)
        .where(
          inArray(
            planVotes.optionId,
            opts.map((o) => o.id),
          ),
        )
    : [];
  const name = new Map(people.map((p) => [p.id, p.displayName]));
  const places: Record<string, PlanPlace> = {};
  const final = finalPlan(catalog, plan, people.length);
  for (const o of opts) {
    const p = o.placeId ? catalog.byId.get(o.placeId) : null;
    if (p) places[p.id] = lite(p);
  }
  for (const s of final?.stops ?? []) {
    const p = catalog.byId.get(s.placeId);
    if (p) places[p.id] = lite(p);
  }

  return {
    plan: {
      id: plan.id,
      code: plan.code,
      title: plan.title,
      description: plan.description,
      budgetPerPerson: plan.budgetPerPerson,
      status: plan.status,
      finalDate: plan.finalDate,
      finalTimeGiven: !!plan.finalDate?.includes("T"),
      version: plan.version,
      createdAt: plan.createdAt.getTime(),
    },
    me: me ? { id: me.id, role: me.role, displayName: me.displayName, isGuest: !me.userId } : null,
    participants: people.map((p) => ({ id: p.id, displayName: p.displayName, role: p.role, isGuest: !p.userId })),
    options: opts
      // A place that has since been unpublished can't be voted on.
      .filter((o) => o.kind === "date" || (o.placeId && places[o.placeId]))
      .map((o) => {
        const v = votes.filter((x) => x.optionId === o.id).map((x) => ({ participantId: x.participantId, value: x.value }));
        return {
          id: o.id,
          kind: o.kind,
          placeId: o.placeId,
          date: o.dateValue,
          note: o.note,
          proposedBy: { id: o.proposedBy, name: name.get(o.proposedBy) ?? "" },
          votes: v,
          score: v.reduce((a, x) => a + (x.value === 1 ? 2 : x.value === 0 ? 1 : -2), 0),
        };
      }),
    comments: comments.map((c) => ({ id: c.id, body: c.body, author: { id: c.participantId, name: name.get(c.participantId) ?? "" }, createdAt: c.createdAt.getTime() })),
    places,
    final,
  };
}

/** Shared plans the signed-in user organises or joined. */
export async function myPlans(userId: string) {
  return db
    .select({
      code: sharedPlans.code,
      title: sharedPlans.title,
      status: sharedPlans.status,
      finalDate: sharedPlans.finalDate,
      role: planParticipants.role,
      updatedAt: sharedPlans.updatedAt,
      organizer: users.displayName,
    })
    .from(planParticipants)
    .innerJoin(sharedPlans, eq(sharedPlans.id, planParticipants.planId))
    .innerJoin(users, eq(users.id, sharedPlans.organizerId))
    .where(eq(planParticipants.userId, userId))
    .orderBy(sql`${sharedPlans.updatedAt} desc`);
}
