import { column, defineTable, NOW } from "astro:db";

export const DailyWords = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    term: column.text(),
    meaning: column.text(),
    exampleText: column.text({ optional: true }),
    category: column.text({ optional: true }),
    challengeDate: column.date({ optional: true }),
    isCompleted: column.boolean({ default: false }),
    completedAt: column.date({ optional: true }),
    isFavorite: column.boolean({ default: false }),
    status: column.text({ enum: ["active", "archived"], default: "active" }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    archivedAt: column.date({ optional: true }),
  },
  indexes: [
    { on: ["userId", "status"] },
    { on: ["userId", "updatedAt"] },
    { on: ["userId", "category"] },
    { on: ["userId", "challengeDate"] },
    { on: ["userId", "isFavorite"] },
    { on: ["userId", "isCompleted"] },
  ],
});

export const dailyWordChallengeTables = {
  DailyWords,
} as const;
