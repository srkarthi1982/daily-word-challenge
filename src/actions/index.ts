import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { db, eq, and, DailyChallenges, DailyChallengeAttempts, UserChallengeStats } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createChallenge: defineAction({
    input: z.object({
      challengeDate: z.string().min(1, "Date is required"),
      language: z.string().optional(),
      word: z.string().min(1, "Word is required"),
      definition: z.string().optional(),
      exampleSentence: z.string().optional(),
      hint: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      meta: z.any().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input) => {
      const [challenge] = await db
        .insert(DailyChallenges)
        .values({
          challengeDate: input.challengeDate,
          language: input.language ?? "en",
          word: input.word,
          definition: input.definition,
          exampleSentence: input.exampleSentence,
          hint: input.hint,
          difficulty: input.difficulty ?? "medium",
          meta: input.meta,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
        })
        .returning();

      return { challenge };
    },
  }),

  updateChallenge: defineAction({
    input: z.object({
      id: z.number().int(),
      challengeDate: z.string().optional(),
      language: z.string().optional(),
      word: z.string().optional(),
      definition: z.string().optional(),
      exampleSentence: z.string().optional(),
      hint: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      meta: z.any().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input) => {
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(DailyChallenges)
        .where(eq(DailyChallenges.id, id))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Challenge not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { challenge: existing };
      }

      const [challenge] = await db
        .update(DailyChallenges)
        .set(updateData)
        .where(eq(DailyChallenges.id, id))
        .returning();

      return { challenge };
    },
  }),

  getActiveChallengeForDate: defineAction({
    input: z.object({
      challengeDate: z.string().min(1),
      language: z.string().optional(),
    }),
    handler: async (input) => {
      const [challenge] = await db
        .select()
        .from(DailyChallenges)
        .where(
          and(
            eq(DailyChallenges.challengeDate, input.challengeDate),
            eq(DailyChallenges.language, input.language ?? "en")
          )
        )
        .limit(1);

      if (!challenge || !challenge.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Challenge not found.",
        });
      }

      return { challenge };
    },
  }),

  recordAttempt: defineAction({
    input: z.object({
      challengeId: z.number().int(),
      guess: z.string().min(1, "Guess is required"),
      isCorrect: z.boolean().optional(),
      attemptNumber: z.number().int().positive().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [challenge] = await db
        .select()
        .from(DailyChallenges)
        .where(eq(DailyChallenges.id, input.challengeId))
        .limit(1);

      if (!challenge || !challenge.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Challenge not available.",
        });
      }

      const [attempt] = await db
        .insert(DailyChallengeAttempts)
        .values({
          challengeId: input.challengeId,
          userId: user.id,
          guess: input.guess,
          isCorrect: input.isCorrect ?? false,
          attemptNumber: input.attemptNumber ?? 1,
          createdAt: new Date(),
        })
        .returning();

      // Update user stats
      const [existingStats] = await db
        .select()
        .from(UserChallengeStats)
        .where(eq(UserChallengeStats.userId, user.id))
        .limit(1);

      const isCorrect = input.isCorrect ?? false;
      const today = challenge.challengeDate;

      const updatedStats = existingStats
        ? {
            totalPlayed: existingStats.totalPlayed + 1,
            totalSolved: existingStats.totalSolved + (isCorrect ? 1 : 0),
            currentStreak: isCorrect ? existingStats.currentStreak + 1 : 0,
            bestStreak: isCorrect
              ? Math.max(existingStats.bestStreak, existingStats.currentStreak + 1)
              : existingStats.bestStreak,
            lastPlayedDate: today,
            lastSolvedDate: isCorrect ? today : existingStats.lastSolvedDate,
          }
        : {
            totalPlayed: 1,
            totalSolved: isCorrect ? 1 : 0,
            currentStreak: isCorrect ? 1 : 0,
            bestStreak: isCorrect ? 1 : 0,
            lastPlayedDate: today,
            lastSolvedDate: isCorrect ? today : null,
            userId: user.id,
            updatedAt: new Date(),
          };

      if (existingStats) {
        await db
          .update(UserChallengeStats)
          .set({
            ...existingStats,
            ...updatedStats,
            updatedAt: new Date(),
          })
          .where(eq(UserChallengeStats.id, existingStats.id));
      } else {
        await db.insert(UserChallengeStats).values(updatedStats);
      }

      return { attempt };
    },
  }),

  listAttempts: defineAction({
    input: z
      .object({
        challengeId: z.number().int().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const attempts = await db
        .select()
        .from(DailyChallengeAttempts)
        .where(eq(DailyChallengeAttempts.userId, user.id));

      const filtered = input?.challengeId
        ? attempts.filter((a) => a.challengeId === input.challengeId)
        : attempts;

      return { attempts: filtered };
    },
  }),

  getStats: defineAction({
    input: z.object({}).optional(),
    handler: async (_, context) => {
      const user = requireUser(context);

      const [stats] = await db
        .select()
        .from(UserChallengeStats)
        .where(eq(UserChallengeStats.userId, user.id))
        .limit(1);

      return { stats: stats ?? null };
    },
  }),
};
