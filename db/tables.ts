import { column, defineTable, NOW } from "astro:db";

/**
 * The daily word challenge itself.
 * Typically one word per day per language.
 */
export const DailyChallenges = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // Date of the challenge (UTC-normalized as ISO date string)
    challengeDate: column.text(), // e.g. "2025-12-06"

    // Language code for this challenge
    language: column.text({ default: "en" }),

    // The target word
    word: column.text(),

    // Optional extra info to show AFTER they solve it
    definition: column.text({ optional: true }),
    exampleSentence: column.text({ optional: true }),
    hint: column.text({ optional: true }),

    // Difficulty of today’s word
    difficulty: column.text({
      enum: ["easy", "medium", "hard"],
      default: "medium",
    }),

    // Extra metadata (e.g. partOfSpeech, phonetics, etc.)
    meta: column.json({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * Each user's attempts for a given day's challenge.
 */
export const DailyChallengeAttempts = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    challengeId: column.number({
      references: () => DailyChallenges.columns.id,
    }),

    userId: column.text(),

    // What they submitted; can be a word, definition text, or structured payload
    guess: column.text(),

    // Whether that guess completed the challenge
    isCorrect: column.boolean({ default: false }),

    // Attempt number (1 = first try, etc.)
    attemptNumber: column.number({ default: 1 }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * Aggregated stats and streaks per user.
 */
export const UserChallengeStats = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    userId: column.text(),

    // Overall stats
    totalPlayed: column.number({ default: 0 }),
    totalSolved: column.number({ default: 0 }),

    // Streak info
    currentStreak: column.number({ default: 0 }),
    bestStreak: column.number({ default: 0 }),

    // The last date they played/solved
    lastPlayedDate: column.text({ optional: true }),  // "2025-12-06"
    lastSolvedDate: column.text({ optional: true }),

    updatedAt: column.date({ default: NOW }),
  },
});

export const dailyWordChallengeTables = {
  DailyChallenges,
  DailyChallengeAttempts,
  UserChallengeStats,
} as const;
