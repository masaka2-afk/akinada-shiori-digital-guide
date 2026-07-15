import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mapSyncCache = sqliteTable("map_sync_cache", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  syncedAt: text("synced_at").notNull(),
  spotCount: integer("spot_count").notNull(),
  sourceHash: text("source_hash").notNull(),
  lastError: text("last_error"),
});
