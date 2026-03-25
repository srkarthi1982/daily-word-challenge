import { db, DailyWords, desc, eq, and } from "astro:db";

export type DailyWordStatus = "active" | "archived";

export async function listDailyWords(userId: string) {
  return db
    .select()
    .from(DailyWords)
    .where(eq(DailyWords.userId, userId))
    .orderBy(desc(DailyWords.updatedAt));
}

export async function getDailyWordDetail(userId: string, id: number) {
  const [word] = await db
    .select()
    .from(DailyWords)
    .where(and(eq(DailyWords.userId, userId), eq(DailyWords.id, id)))
    .limit(1);

  return word ?? null;
}

export function buildDailyWordSummary(words: Awaited<ReturnType<typeof listDailyWords>>) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const totalWords = words.length;
  const activeWords = words.filter((word) => word.status === "active").length;
  const archivedWords = words.filter((word) => word.status === "archived").length;
  const completedWords = words.filter((word) => word.isCompleted).length;
  const favoriteWords = words.filter((word) => word.isFavorite).length;
  const todaysChallengeCount = words.filter((word) => {
    if (!word.challengeDate) return false;
    return new Date(word.challengeDate).toISOString().slice(0, 10) === todayIso;
  }).length;

  return {
    totalWords,
    activeWords,
    archivedWords,
    completedWords,
    favoriteWords,
    todaysChallengeCount,
    mostRecentWordTerm: words[0]?.term ?? null,
  };
}
