import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  needsSponsorship: boolean("needs_sponsorship").default(false).notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  digestEnabled: boolean("digest_enabled").default(true).notNull(),
  anthropicKeyEnc: text("anthropic_key_enc"),
  notionTokenEnc: text("notion_token_enc"),
  notionDatabaseId: text("notion_database_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userKeywords = pgTable("user_keywords", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  keyword: text("keyword").notNull(),
  kind: text("kind", { enum: ["include", "exclude"] }).default("include").notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  ats: text("ats", { enum: ["greenhouse", "lever", "ashby", "workday", "linkedin"] }).notNull(),
  slug: text("slug"),
  tenant: text("tenant"),
  host: text("host"),
  site: text("site"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userCompanies = pgTable(
  "user_companies",
  {
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    list: text("list", { enum: ["dream", "watch"] }).default("watch").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.companyId] }) }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(),
    extId: text("ext_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    location: text("location").default("").notNull(),
    description: text("description").default("").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ uniq: uniqueIndex("jobs_source_company_ext").on(t.source, t.companyName, t.extId) }),
);

export const userJobStatus = pgTable(
  "user_job_status",
  {
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
    status: text("status", {
      enum: ["new", "reviewing", "applied", "interviewing", "offer", "rejected", "skipped"],
    }).default("new").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.jobId] }) }),
);

export const digestLog = pgTable("digest_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  jobCount: integer("job_count").default(0).notNull(),
});
