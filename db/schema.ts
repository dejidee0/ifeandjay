import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rsvps = sqliteTable("rsvps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guestName: text("guest_name").notNull(),
  contact: text("contact").notNull(),
  attendance: text("attendance").notNull(),
  guestCount: integer("guest_count").notNull().default(1),
  confirmationCode: text("confirmation_code").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const guestMessages = sqliteTable(
  "guest_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guestName: text("guest_name").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_guest_messages_status_created_at").on(table.status, table.createdAt),
  ],
);
