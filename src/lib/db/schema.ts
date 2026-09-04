import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  shortName: text("short_name").notNull().default(""),
  status: text("status").notNull().default("applied"),
  statusRaw: text("status_raw").notNull().default(""),
  location: text("location").notNull().default(""),
  dateApplied: text("date_applied").notNull().default(""),
  dateDiscussed: text("date_discussed").notNull().default(""),
  datePrecision: text("date_precision").notNull().default("unknown"),
  rate: text("rate").notNull().default(""),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryPeriod: text("salary_period").notNull().default(""),
  annualMid: integer("annual_mid"),
  matchScore: doublePrecision("match_score"),
  matchLevel: text("match_level").notNull().default(""),
  userInterest: text("user_interest").notNull().default(""),
  description: text("description").notNull().default(""),
  source: text("source").notNull().default(""),
  url: text("url").notNull().default(""),
  department: text("department").notNull().default(""),
  employmentType: text("employment_type").notNull().default(""),
  interviewDate: text("interview_date").notNull().default(""),
  interviewNotes: text("interview_notes").notNull().default(""),
  notes: text("notes").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  strongMatches: jsonb("strong_matches").$type<string[]>().notNull().default([]),
  gaps: jsonb("gaps").$type<string[]>().notNull().default([]),
  isTarget: boolean("is_target").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visits = pgTable("visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  path: text("path").notNull().default("/"),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  country: text("country").notNull().default(""),
  device: text("device").notNull().default(""),
  referrer: text("referrer").notNull().default(""),
  timezone: text("timezone").notNull().default(""),
  language: text("language").notNull().default(""),
  screen: text("screen").notNull().default(""),
  sessionFingerprint: text("session_fingerprint").notNull().default(""),
  linkedApplicationId: uuid("linked_application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  linkConfidence: text("link_confidence").notNull().default("none"),
  linkReason: text("link_reason").notNull().default(""),
});

/** Device fingerprints that should skip ntfy/Discord (also dual-checked with VISIT_IGNORE_DEVICE_IDS). */
export const ignoredDevices = pgTable("ignored_devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Key/value site settings (admin toggles, dismissed pipeline home panels, etc.). */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  valueJson: jsonb("value_json").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Repeat visitors who identified themselves via the public resume prompt.
 * One row per device — used to avoid re-asking.
 */
export const visitorIdentifications = pgTable("visitor_identifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  freeText: text("free_text").notNull().default(""),
  confirmedSuggested: boolean("confirmed_suggested").notNull().default(false),
  contactName: text("contact_name").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  leadCompany: text("lead_company").notNull().default(""),
  leadTitle: text("lead_title").notNull().default(""),
  leadLocation: text("lead_location").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApplicationRow = typeof applications.$inferSelect;
export type VisitRow = typeof visits.$inferSelect;
export type IgnoredDeviceRow = typeof ignoredDevices.$inferSelect;
export type SiteSettingRow = typeof siteSettings.$inferSelect;
export type VisitorIdentificationRow = typeof visitorIdentifications.$inferSelect;
