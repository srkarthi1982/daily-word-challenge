import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { db, DailyWords, eq, and, count } from "astro:db";
import { buildDailyWordSummary, getDailyWordDetail, listDailyWords } from "../lib/daily-words";
import { pushDashboardSummary, sendHighSignalNotification } from "../lib/integrations";

function requireUser(context: ActionAPIContext) {
  const user = context.locals.user;
  if (!user?.id) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnershipWord(userId: string, id: number) {
  const word = await getDailyWordDetail(userId, id);

  if (!word) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Word entry not found.",
    });
  }

  return word;
}

export const server = {
  createDailyWord: defineAction({
    input: z.object({
      term: z.string().trim().min(1).max(120),
      meaning: z.string().trim().min(1).max(500),
      exampleText: z.string().trim().max(500).optional().nullable(),
      category: z.string().trim().max(80).optional().nullable(),
      challengeDate: z.coerce.date().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [createdWord] = await db
        .insert(DailyWords)
        .values({
          userId: user.id,
          term: input.term,
          meaning: input.meaning,
          exampleText: input.exampleText || null,
          category: input.category || null,
          challengeDate: input.challengeDate || null,
          status: "active",
          isCompleted: false,
          isFavorite: false,
          completedAt: null,
          archivedAt: null,
          updatedAt: new Date(),
          createdAt: new Date(),
        })
        .returning();

      const [userWordCount] = await db
        .select({ value: count() })
        .from(DailyWords)
        .where(eq(DailyWords.userId, user.id));

      if (userWordCount?.value === 1) {
        await sendHighSignalNotification(user.id, "first_word_created", {
          term: createdWord.term,
        });
      }

      await pushDashboardSummary(user.id, context);

      return { word: createdWord };
    },
  }),

  updateDailyWord: defineAction({
    input: z.object({
      id: z.number().int().positive(),
      term: z.string().trim().min(1).max(120).optional(),
      meaning: z.string().trim().min(1).max(500).optional(),
      exampleText: z.string().trim().max(500).optional().nullable(),
      category: z.string().trim().max(80).optional().nullable(),
      challengeDate: z.coerce.date().optional().nullable(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnershipWord(user.id, input.id);

      const [updatedWord] = await db
        .update(DailyWords)
        .set({
          term: input.term ?? existing.term,
          meaning: input.meaning ?? existing.meaning,
          exampleText: input.exampleText === undefined ? existing.exampleText : input.exampleText,
          category: input.category === undefined ? existing.category : input.category,
          challengeDate:
            input.challengeDate === undefined ? existing.challengeDate : input.challengeDate,
          updatedAt: new Date(),
        })
        .where(and(eq(DailyWords.id, input.id), eq(DailyWords.userId, user.id)))
        .returning();

      await pushDashboardSummary(user.id, context);

      return { word: updatedWord };
    },
  }),

  archiveDailyWord: defineAction({
    input: z.object({ id: z.number().int().positive() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnershipWord(user.id, input.id);

      const [updatedWord] = await db
        .update(DailyWords)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(DailyWords.id, input.id), eq(DailyWords.userId, user.id)))
        .returning();

      await pushDashboardSummary(user.id, context);
      return { word: updatedWord };
    },
  }),

  restoreDailyWord: defineAction({
    input: z.object({ id: z.number().int().positive() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnershipWord(user.id, input.id);

      const [updatedWord] = await db
        .update(DailyWords)
        .set({
          status: "active",
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(DailyWords.id, input.id), eq(DailyWords.userId, user.id)))
        .returning();

      await pushDashboardSummary(user.id, context);
      return { word: updatedWord };
    },
  }),

  toggleDailyWordFavorite: defineAction({
    input: z.object({ id: z.number().int().positive() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnershipWord(user.id, input.id);

      const nextFavoriteState = !existing.isFavorite;

      const [updatedWord] = await db
        .update(DailyWords)
        .set({
          isFavorite: nextFavoriteState,
          updatedAt: new Date(),
        })
        .where(and(eq(DailyWords.id, input.id), eq(DailyWords.userId, user.id)))
        .returning();

      if (nextFavoriteState) {
        const [favoriteCount] = await db
          .select({ value: count() })
          .from(DailyWords)
          .where(and(eq(DailyWords.userId, user.id), eq(DailyWords.isFavorite, true)));

        if (favoriteCount?.value === 1) {
          await sendHighSignalNotification(user.id, "first_word_favorited", {
            term: updatedWord.term,
          });
        }
      }

      await pushDashboardSummary(user.id, context);
      return { word: updatedWord };
    },
  }),

  toggleDailyWordCompleted: defineAction({
    input: z.object({ id: z.number().int().positive() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await getOwnershipWord(user.id, input.id);

      const nextCompletedState = !existing.isCompleted;

      const [updatedWord] = await db
        .update(DailyWords)
        .set({
          isCompleted: nextCompletedState,
          completedAt: nextCompletedState ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(DailyWords.id, input.id), eq(DailyWords.userId, user.id)))
        .returning();

      if (nextCompletedState) {
        const [completedCount] = await db
          .select({ value: count() })
          .from(DailyWords)
          .where(and(eq(DailyWords.userId, user.id), eq(DailyWords.isCompleted, true)));

        if (completedCount?.value === 1) {
          await sendHighSignalNotification(user.id, "first_word_completed", {
            term: updatedWord.term,
          });
        }
      }

      await pushDashboardSummary(user.id, context);
      return { word: updatedWord };
    },
  }),

  listDailyWords: defineAction({
    input: z.object({ includeArchived: z.boolean().optional() }).optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const words = await listDailyWords(user.id);
      const summary = buildDailyWordSummary(words);

      return {
        words: input?.includeArchived ? words : words.filter((word) => word.status === "active"),
        summary,
      };
    },
  }),

  getDailyWordDetail: defineAction({
    input: z.object({ id: z.number().int().positive() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const word = await getDailyWordDetail(user.id, input.id);

      if (!word) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Word entry not found.",
        });
      }

      return { word };
    },
  }),
};
