import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now);

/* ------------------------------------------------------------------ */
/* Shared JSON shapes                                                   */
/* ------------------------------------------------------------------ */

export type ImageCredit = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  author?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
  /** "commons" | "upload" | "official" */
  origin: string;
};

export type GeoPolygon = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

/** Tri-state attribute with provenance. null value = unknown. */
export type Attribute = {
  value: boolean | null;
  /** "verified" (editor checked), "osm" (OpenStreetMap tag), "category" (inferred from place type) */
  source: "verified" | "osm" | "category" | "official";
};

export type PlaceAttributes = Partial<
  Record<
    | "familyFriendly"
    | "indoor"
    | "outdoor"
    | "free"
    | "groups"
    | "wheelchair"
    | "photoSpot"
    | "romantic"
    | "quiet",
    Attribute
  >
>;

export type ItineraryStop = {
  id: string;
  placeId: string;
  durationMin: number;
  /** Per-person estimate used for this stop (SAR); null = unknown */
  costPerPerson: number | null;
  costBasis: "verified" | "estimate" | "free" | "unknown";
  note?: string;
};

export type NotificationPrefs = {
  savedEvents: boolean;
  outingReminders: boolean;
  eventChanges: boolean;
  planInvites: boolean;
  planActivity: boolean;
  promotional: boolean;
};

export type PrivacyPrefs = {
  profilePublic: boolean;
  showVisited: boolean;
  showReviewsOnProfile: boolean;
  personalize: boolean;
};

/* ------------------------------------------------------------------ */
/* Users & auth                                                         */
/* ------------------------------------------------------------------ */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    locale: text("locale", { enum: ["en", "ar"] }).notNull().default("en"),
    interests: text("interests", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    favoriteCategories: text("favorite_categories", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** Typical per-person budget in SAR the user selected, if any. */
    budgetPreference: integer("budget_preference"),
    homeNeighbourhood: text("home_neighbourhood"),
    privacy: text("privacy", { mode: "json" })
      .$type<PrivacyPrefs>()
      .notNull()
      .default(sql`'{"profilePublic":false,"showVisited":false,"showReviewsOnProfile":true,"personalize":true}'`),
    notificationPrefs: text("notification_prefs", { mode: "json" })
      .$type<NotificationPrefs>()
      .notNull()
      .default(
        sql`'{"savedEvents":true,"outingReminders":true,"eventChanges":true,"planInvites":true,"planActivity":true,"promotional":false}'`,
      ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the cookie token, never the token itself */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Places                                                               */
/* ------------------------------------------------------------------ */

export const categories = sqliteTable("categories", {
  slug: text("slug").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  taglineEn: text("tagline_en"),
  taglineAr: text("tagline_ar"),
  cover: text("cover", { mode: "json" }).$type<ImageCredit | null>(),
  color: text("color").notNull().default("#127C83"),
  sortOrder: integer("sort_order").notNull().default(0),
  showOnHome: integer("show_on_home", { mode: "boolean" }).notNull().default(true),
});

export const neighbourhoods = sqliteTable("neighbourhoods", {
  slug: text("slug").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  introEn: text("intro_en"),
  introAr: text("intro_ar"),
  practicalEn: text("practical_en"),
  practicalAr: text("practical_ar"),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  bbox: text("bbox", { mode: "json" }).$type<[number, number, number, number]>().notNull(),
  polygon: text("polygon", { mode: "json" }).$type<GeoPolygon>(),
  hero: text("hero", { mode: "json" }).$type<ImageCredit | null>(),
  /** Shown as a destination guide in the Neighbourhood Explorer */
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(100),
  source: text("source").notNull().default("osm"),
});

export const places = sqliteTable(
  "places",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en"),
    nameAr: text("name_ar"),
    category: text("category").notNull(),
    secondaryCategories: text("secondary_categories", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** Source taxonomy, e.g. "italian_restaurant", "coffee_shop", "museum" */
    subcategory: text("subcategory"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    occasions: text("occasions", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    neighbourhood: text("neighbourhood").references(() => neighbourhoods.slug),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    instagram: text("instagram"),
    /** OpenStreetMap opening_hours syntax */
    openingHours: text("opening_hours"),
    hoursSource: text("hours_source"),
    hoursCheckedAt: integer("hours_checked_at", { mode: "timestamp_ms" }),
    /** Verified per-person price range in SAR (set by editors from an official source) */
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    priceSource: text("price_source"),
    priceCheckedAt: integer("price_checked_at", { mode: "timestamp_ms" }),
    /** 1-4, only when known */
    priceLevel: integer("price_level"),
    attributes: text("attributes", { mode: "json" }).$type<PlaceAttributes>().notNull().default(sql`'{}'`),
    facilities: text("facilities", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    accessibilityNote: text("accessibility_note"),
    images: text("images", { mode: "json" }).$type<ImageCredit[]>().notNull().default(sql`'[]'`),
    /** Brand key for chains with several branches */
    brand: text("brand"),
    isChain: integer("is_chain", { mode: "boolean" }).notNull().default(false),
    /** "editorial" | "overture" | "osm" | "community" | "admin" */
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    sourceDetail: text("source_detail"),
    /** "unverified" (imported) | "verified" (editor-checked) | "community" */
    verification: text("verification", { enum: ["unverified", "verified", "community"] }).notNull().default("unverified"),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("published"),
    editorsPick: integer("editors_pick", { mode: "boolean" }).notNull().default(false),
    hiddenGem: integer("hidden_gem", { mode: "boolean" }).notNull().default(false),
    hiddenGemNoteEn: text("hidden_gem_note_en"),
    hiddenGemNoteAr: text("hidden_gem_note_ar"),
    /** Editor flagged as possibly outdated */
    flaggedOutdated: integer("flagged_outdated", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("places_slug_idx").on(t.slug),
    index("places_category_idx").on(t.category),
    index("places_hood_idx").on(t.neighbourhood),
    index("places_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Personal data                                                        */
/* ------------------------------------------------------------------ */

export const saves = sqliteTable(
  "saves",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.placeId] }), index("saves_place_idx").on(t.placeId)],
);

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    shareToken: text("share_token"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("collections_user_idx").on(t.userId), uniqueIndex("collections_share_idx").on(t.shareToken)],
);

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.placeId] })],
);

export const placeNotes = sqliteTable(
  "place_notes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.placeId] })],
);

export const visits = sqliteTable(
  "visits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    visitedOn: text("visited_on"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.placeId] })],
);

/** Recommendations the user asked us not to show again */
export const hiddenRecommendations = sqliteTable(
  "hidden_recommendations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.placeId] })],
);

/** Signed-in interaction history used for personalisation (only when privacy.personalize is on). */
export const interactions = sqliteTable(
  "interactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id").references(() => places.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["view", "search", "plan"] }).notNull(),
    query: text("query"),
    createdAt: createdAt(),
  },
  (t) => [index("interactions_user_idx").on(t.userId, t.createdAt)],
);

/** Anonymous, aggregated daily counters (no user identifiers) for trending & analytics. */
export const placeStats = sqliteTable(
  "place_stats",
  {
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    plans: integer("plans").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.day] }), index("place_stats_day_idx").on(t.day)],
);

/** Anonymous search log (query text + result count only). */
export const searchLog = sqliteTable(
  "search_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    query: text("query").notNull(),
    normalized: text("normalized").notNull(),
    locale: text("locale").notNull(),
    results: integer("results").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("search_log_norm_idx").on(t.normalized), index("search_log_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Itineraries                                                          */
/* ------------------------------------------------------------------ */

export const itineraries = sqliteTable(
  "itineraries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: text("date"),
    startTime: text("start_time"),
    durationMin: integer("duration_min").notNull(),
    groupType: text("group_type").notNull(),
    groupSize: integer("group_size").notNull(),
    budget: integer("budget"),
    budgetMode: text("budget_mode", { enum: ["per_person", "group"] }).notNull().default("per_person"),
    interests: text("interests", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    transport: text("transport").notNull().default("car"),
    startLabel: text("start_label"),
    startLat: real("start_lat"),
    startLng: real("start_lng"),
    stops: text("stops", { mode: "json" }).$type<ItineraryStop[]>().notNull().default(sql`'[]'`),
    shareToken: text("share_token"),
    remindedAt: integer("reminded_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("itineraries_user_idx").on(t.userId), uniqueIndex("itineraries_share_idx").on(t.shareToken)],
);

/* ------------------------------------------------------------------ */
/* Events                                                               */
/* ------------------------------------------------------------------ */

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar"),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    category: text("category").notNull(),
    venueName: text("venue_name").notNull(),
    venueNameAr: text("venue_name_ar"),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    lat: real("lat"),
    lng: real("lng"),
    neighbourhood: text("neighbourhood"),
    /** ISO dates (YYYY-MM-DD) in Asia/Riyadh */
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    openingTimes: text("opening_times"),
    openingTimesAr: text("opening_times_ar"),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    priceNote: text("price_note"),
    isFree: integer("is_free", { mode: "boolean" }),
    ageRestriction: text("age_restriction"),
    ticketUrl: text("ticket_url"),
    officialUrl: text("official_url"),
    image: text("image", { mode: "json" }).$type<ImageCredit | null>(),
    /** "admin" = entered by an administrator; "feed" = from a configured event feed */
    origin: text("origin", { enum: ["admin", "feed"] }).notNull().default("admin"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
    changeNote: text("change_note"),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("events_slug_idx").on(t.slug), index("events_dates_idx").on(t.startDate, t.endDate)],
);

export const eventSaves = sqliteTable(
  "event_saves",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    remindedAt: integer("reminded_at", { mode: "timestamp_ms" }),
    notifiedChangeAt: integer("notified_change_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

/* ------------------------------------------------------------------ */
/* Community                                                            */
/* ------------------------------------------------------------------ */

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    visitDate: text("visit_date"),
    /** "lower" | "as_expected" | "higher" than expected */
    priceAssessment: text("price_assessment"),
    spentPerPerson: integer("spent_per_person"),
    photos: text("photos", { mode: "json" }).$type<ImageCredit[]>().notNull().default(sql`'[]'`),
    status: text("status", { enum: ["published", "hidden", "removed"] }).notNull().default("published"),
    moderatorNote: text("moderator_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("reviews_user_place_idx").on(t.userId, t.placeId), index("reviews_place_idx").on(t.placeId)],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional link to an existing place being recommended as a gem */
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    gemType: text("gem_type").notNull(),
    description: text("description").notNull(),
    tips: text("tips"),
    lat: real("lat"),
    lng: real("lng"),
    neighbourhood: text("neighbourhood"),
    photos: text("photos", { mode: "json" }).$type<ImageCredit[]>().notNull().default(sql`'[]'`),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    moderatorNote: text("moderator_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("submissions_status_idx").on(t.status)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type", { enum: ["place", "review", "submission", "event"] }).notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    resolution: text("resolution"),
    resolvedBy: text("resolved_by"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status), index("reports_target_idx").on(t.targetType, t.targetId)],
);

/* ------------------------------------------------------------------ */
/* Social planning                                                      */
/* ------------------------------------------------------------------ */

export const sharedPlans = sqliteTable(
  "shared_plans",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    budgetPerPerson: integer("budget_per_person"),
    status: text("status", { enum: ["planning", "final", "cancelled"] }).notNull().default("planning"),
    finalDate: text("final_date"),
    finalStops: text("final_stops", { mode: "json" }).$type<ItineraryStop[] | null>(),
    /** Monotonic counter bumped on every change so clients can poll cheaply */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("shared_plans_code_idx").on(t.code)],
);

export const planParticipants = sqliteTable(
  "plan_participants",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => sharedPlans.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** sha256 of a guest token stored in an httpOnly cookie */
    guestTokenHash: text("guest_token_hash"),
    role: text("role", { enum: ["organizer", "participant"] }).notNull().default("participant"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("plan_participants_plan_idx").on(t.planId), index("plan_participants_user_idx").on(t.userId)],
);

export const planOptions = sqliteTable(
  "plan_options",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => sharedPlans.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["place", "date"] }).notNull(),
    placeId: text("place_id").references(() => places.id, { onDelete: "cascade" }),
    dateValue: text("date_value"),
    note: text("note"),
    proposedBy: text("proposed_by")
      .notNull()
      .references(() => planParticipants.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("plan_options_plan_idx").on(t.planId)],
);

export const planVotes = sqliteTable(
  "plan_votes",
  {
    optionId: text("option_id")
      .notNull()
      .references(() => planOptions.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => planParticipants.id, { onDelete: "cascade" }),
    /** 1 = yes, 0 = maybe, -1 = no */
    value: integer("value").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.participantId] })],
);

export const planComments = sqliteTable(
  "plan_comments",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => sharedPlans.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => planParticipants.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("plan_comments_plan_idx").on(t.planId)],
);

/* ------------------------------------------------------------------ */
/* Notifications, featured content, housekeeping                        */
/* ------------------------------------------------------------------ */

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, string | number | null>>().notNull(),
    /** Prevents duplicate notifications for the same trigger */
    dedupeKey: text("dedupe_key"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt), uniqueIndex("notifications_dedupe_idx").on(t.dedupeKey)],
);

export const heroSlides = sqliteTable("hero_slides", {
  id: text("id").primaryKey(),
  theme: text("theme").notNull(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  subtitleEn: text("subtitle_en"),
  subtitleAr: text("subtitle_ar"),
  image: text("image", { mode: "json" }).$type<ImageCredit>().notNull(),
  href: text("href").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Neighbourhood = typeof neighbourhoods.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Itinerary = typeof itineraries.$inferSelect;
export type SharedPlan = typeof sharedPlans.$inferSelect;
