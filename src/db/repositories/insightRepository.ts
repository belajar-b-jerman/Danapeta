import { generateInsights } from "../../lib/insightEngine";
import { db } from "../client";
import { getPlanningProfile } from "./planningProfileRepository";
import type { Insight } from "../schema";

export async function listInsights(period?: string, includeDismissed = false) {
  const insights = period ? await db.insights.where("period").equals(period).toArray() : await db.insights.toArray();
  return dedupeInsights(insights)
    .filter((insight) => !insight.deletedAt)
    .filter((insight) => includeDismissed || insight.status !== "dismissed")
    .sort(compareInsights);
}

export async function generateInsightFeed(period = currentPeriodKey()) {
  const [accounts, assets, liabilities, categories, transactions, budgets, goals, recurringRules, planningProfile, existing] = await Promise.all([
    db.accounts.toArray(),
    db.assets.toArray(),
    db.liabilities.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.recurringRules.toArray(),
    getPlanningProfile(),
    db.insights.where("period").equals(period).toArray()
  ]);
  const existingByRule = new Map(dedupeInsights(existing).map((insight) => [insight.ruleId, insight]));
  const generated = generateInsights({ period, accounts, assets, liabilities, categories, transactions, budgets, goals, recurringRules, planningProfile });
  const nextInsights = generated.map((insight) => ({
    ...insight,
    createdAt: existingByRule.get(insight.ruleId)?.createdAt ?? insight.createdAt,
    status: existingByRule.get(insight.ruleId)?.status ?? insight.status,
    version: (existingByRule.get(insight.ruleId)?.version ?? 0) + 1
  }));
  const nextIds = new Set(nextInsights.map((insight) => insight.id));

  await db.transaction("rw", db.insights, async () => {
    await Promise.all(existing.filter((insight) => !nextIds.has(insight.id)).map((insight) => db.insights.delete(insight.id)));
    if (nextInsights.length > 0) await db.insights.bulkPut(nextInsights);
  });

  return listInsights(period);
}

export async function updateInsightStatus(id: string, status: Insight["status"]) {
  const existing = await db.insights.get(id);
  if (!existing) return undefined;
  await db.insights.update(id, {
    status,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1
  });
  return db.insights.get(id);
}

export function getInsightCategory(insight: Insight) {
  return String(insight.evidence.find((item) => item.label === "Category")?.value ?? "recommendations");
}

export function getInsightPriorityScore(insight: Insight) {
  return Number(insight.evidence.find((item) => item.label === "Priority score")?.value ?? 0);
}

function compareInsights(left: Insight, right: Insight) {
  if (left.status === "pinned" && right.status !== "pinned") return -1;
  if (right.status === "pinned" && left.status !== "pinned") return 1;
  return getInsightPriorityScore(right) - getInsightPriorityScore(left);
}

function dedupeInsights(insights: Insight[]) {
  const byRuleId = new Map<string, Insight>();

  insights.forEach((insight) => {
    const existing = byRuleId.get(insight.ruleId);
    if (!existing || compareInsightFreshness(insight, existing) < 0) {
      byRuleId.set(insight.ruleId, insight);
    }
  });

  return Array.from(byRuleId.values());
}

function compareInsightFreshness(left: Insight, right: Insight) {
  if (left.status === "pinned" && right.status !== "pinned") return -1;
  if (right.status === "pinned" && left.status !== "pinned") return 1;
  if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
  return right.createdAt.localeCompare(left.createdAt);
}

function currentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
