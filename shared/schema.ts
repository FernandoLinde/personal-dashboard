import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  youtubeIdentifier: text("youtube_identifier").notNull().unique(), // e.g., @channelname
  category: text("category").notNull(), // Tech, Macro, General
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  youtubeVideoId: text("youtube_video_id").notNull().unique(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  youtubeUrl: text("youtube_url").notNull(),
  publishedAt: timestamp("published_at").notNull(),
  category: text("category").notNull(),
  transcriptText: text("transcript_text"),
  transcriptSource: text("transcript_source"), // "YouTube transcript", "Generated transcript", "Transcript unavailable"
  summaryBullets: jsonb("summary_bullets").$type<string[]>(),
  durationSeconds: integer("duration_seconds"),
  status: text("status").default("pending"), // pending, processed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // running, completed, failed
  videosFound: integer("videos_found").default(0),
  videosCreated: integer("videos_created").default(0),
  videosUpdated: integer("videos_updated").default(0),
  errorsCount: integer("errors_count").default(0),
  logText: text("log_text"),
});

export const channelRelations = relations(channels, ({ many }) => ({
  videos: many(videos),
}));

export const videoRelations = relations(videos, ({ one }) => ({
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
}));

// Base Schemas
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIngestionRunSchema = createInsertSchema(ingestionRuns).omit({ id: true });

// Explicit API Contract Types
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type InsertIngestionRun = z.infer<typeof insertIngestionRunSchema>;

// Response types
export type VideoWithChannel = Video & { channel: Channel };
export type VideoFeedResponse = VideoWithChannel[];
