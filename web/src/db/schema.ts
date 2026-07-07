import {
  bigint,
  boolean,
  real,
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
  fileB64: text("file_b64"),
  fileKind: text("file_kind", { enum: ["docx", "pdf", "tex", "txt"] }),
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
    payMin: integer("pay_min"),
    payMax: integer("pay_max"),
    payPeriod: text("pay_period"),
    yoeMin: integer("yoe_min"),
    enriched: boolean("enriched").default(false).notNull(),
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

export const userJobScores = pgTable(
  "user_job_scores",
  {
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
    score: real("score").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.jobId] }) }),
);

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  employer: text("employer").notNull(),
  norm: text("norm").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  approvals: integer("approvals").default(0).notNull(),
  denials: integer("denials").default(0).notNull(),
});

export const resumeThreads = pgTable(
  "resume_threads",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ uniq: uniqueIndex("resume_threads_user_job").on(t.userId, t.jobId) }),
);

export const resumeMessages = pgTable("resume_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => resumeThreads.id, { onDelete: "cascade" }).notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  tokensIn: integer("tokens_in").default(0).notNull(),
  tokensOut: integer("tokens_out").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userUsage = pgTable(
  "user_usage",
  {
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    month: text("month").notNull(),
    tokensIn: bigint("tokens_in", { mode: "number" }).default(0).notNull(),
    tokensOut: bigint("tokens_out", { mode: "number" }).default(0).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.month] }) }),
);
