import { ActionError } from "astro:actions";
import type { ActionAPIContext } from "astro:actions";
import { buildDailyWordSummary, listDailyWords } from "./daily-words";

function getRootAppUrl(context?: ActionAPIContext) {
  const fromLocals = context?.locals?.rootAppUrl;
  return fromLocals ?? import.meta.env.PUBLIC_ROOT_APP_URL ?? "https://ansiversa.com";
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Integration call failed with status ${response.status}`,
    });
  }
}

export async function pushDashboardSummary(userId: string, context?: ActionAPIContext) {
  const dashboardWebhook = import.meta.env.ANSIVERSA_DASHBOARD_WEBHOOK_URL;
  if (!dashboardWebhook) return;

  const words = await listDailyWords(userId);
  const summary = buildDailyWordSummary(words);

  await postJson(dashboardWebhook, {
    appId: "daily-word-challenge",
    userId,
    summary,
    generatedAt: new Date().toISOString(),
    appUrl: `${getRootAppUrl(context)}/apps/daily-word-challenge`,
  });
}

export async function sendHighSignalNotification(
  userId: string,
  type: "first_word_created" | "first_word_completed" | "first_word_favorited",
  payload: Record<string, unknown> = {}
) {
  const notificationsWebhook = import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL;
  if (!notificationsWebhook) return;

  await postJson(notificationsWebhook, {
    appId: "daily-word-challenge",
    userId,
    type,
    payload,
    happenedAt: new Date().toISOString(),
  });
}
