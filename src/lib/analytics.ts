import { CATEGORY_GROUPS, toneForCategory, type CategoryTone } from "@/lib/format";

export type AnalyticsDocumentRow = {
  id: string;
  category: string;
  createdAt: string;
  companyName: string;
};

export type MonthlyCategoryGroupRow = { month: string } & Record<string, number | string>;

export type AnalyticsData = {
  totalClients: number;
  totalDocuments: number;
  documentsLast30Days: number;
  topCategory: string | null;
  monthlySubmissions: { month: string; count: number }[];
  categoryGroups: { group: string; count: number; tone: CategoryTone }[];
  topCategories: { category: string; count: number; tone: CategoryTone }[];
  topCompanies: { company: string; count: number }[];
  monthlyClients: { month: string; count: number }[];
  monthlyCategoryGroups: MonthlyCategoryGroupRow[];
  monthlyTable: { month: string; documents: number; clients: number; categories: number }[];
  monthlyDetails: MonthDetail[];
};

export type MonthDetail = {
  month: string;
  monthKey: string;
  documents: number;
  clients: number;
  categories: { category: string; count: number; tone: CategoryTone }[];
  companies: { company: string; count: number }[];
};

const GROUP_TONE_BY_NAME: Record<string, CategoryTone> = Object.fromEntries(
  CATEGORY_GROUPS.map((group) => [group.group, group.tone]),
);

const GROUP_BY_CATEGORY: Record<string, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((group) => group.categories.map((category) => [category, group.group])),
);

function monthKey(isoDate: string) {
  const date = new Date(isoDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function last12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const GROUP_NAMES = CATEGORY_GROUPS.map((group) => group.group);

export function computeAnalytics(documents: AnalyticsDocumentRow[], clientCreatedAt: string[]): AnalyticsData {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const monthKeys = last12MonthKeys();

  const monthCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const groupCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();
  const monthClientCounts = new Map<string, number>();
  const monthGroupCounts = new Map<string, Map<string, number>>();
  const monthCategorySet = new Map<string, Set<string>>();
  const monthCategoryCounts = new Map<string, Map<string, number>>();
  const monthCompanyCounts = new Map<string, Map<string, number>>();
  let documentsLast30Days = 0;

  for (const key of monthKeys) {
    monthGroupCounts.set(key, new Map(GROUP_NAMES.map((name) => [name, 0])));
    monthCategorySet.set(key, new Set());
    monthCategoryCounts.set(key, new Map());
    monthCompanyCounts.set(key, new Map());
  }

  for (const doc of documents) {
    const key = monthKey(doc.createdAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);

    categoryCounts.set(doc.category, (categoryCounts.get(doc.category) ?? 0) + 1);

    const group = GROUP_BY_CATEGORY[doc.category] ?? "Other";
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);

    companyCounts.set(doc.companyName, (companyCounts.get(doc.companyName) ?? 0) + 1);

    if (new Date(doc.createdAt).getTime() >= thirtyDaysAgo) documentsLast30Days += 1;

    const groupCountsForMonth = monthGroupCounts.get(key);
    if (groupCountsForMonth) groupCountsForMonth.set(group, (groupCountsForMonth.get(group) ?? 0) + 1);
    monthCategorySet.get(key)?.add(doc.category);

    const categoryCountsForMonth = monthCategoryCounts.get(key);
    if (categoryCountsForMonth) categoryCountsForMonth.set(doc.category, (categoryCountsForMonth.get(doc.category) ?? 0) + 1);

    const companyCountsForMonth = monthCompanyCounts.get(key);
    if (companyCountsForMonth) companyCountsForMonth.set(doc.companyName, (companyCountsForMonth.get(doc.companyName) ?? 0) + 1);
  }

  for (const createdAt of clientCreatedAt) {
    const key = monthKey(createdAt);
    monthClientCounts.set(key, (monthClientCounts.get(key) ?? 0) + 1);
  }

  const monthlySubmissions = monthKeys.map((key) => ({
    month: monthLabel(key),
    count: monthCounts.get(key) ?? 0,
  }));

  const monthlyClients = monthKeys.map((key) => ({
    month: monthLabel(key),
    count: monthClientCounts.get(key) ?? 0,
  }));

  const monthlyCategoryGroups: MonthlyCategoryGroupRow[] = monthKeys.map((key) => {
    const counts = monthGroupCounts.get(key);
    return { month: monthLabel(key), ...Object.fromEntries(GROUP_NAMES.map((name) => [name, counts?.get(name) ?? 0])) };
  });

  const monthlyTable = monthKeys.map((key) => ({
    month: monthLabel(key),
    documents: monthCounts.get(key) ?? 0,
    clients: monthClientCounts.get(key) ?? 0,
    categories: monthCategorySet.get(key)?.size ?? 0,
  }));

  const monthlyDetails: MonthDetail[] = monthKeys.map((key) => ({
    month: monthLabel(key),
    monthKey: key,
    documents: monthCounts.get(key) ?? 0,
    clients: monthClientCounts.get(key) ?? 0,
    categories: [...(monthCategoryCounts.get(key)?.entries() ?? [])]
      .map(([category, count]) => ({ category, count, tone: toneForCategory(category) }))
      .sort((a, b) => b.count - a.count),
    companies: [...(monthCompanyCounts.get(key)?.entries() ?? [])]
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count),
  }));

  const categoryGroups = [...groupCounts.entries()]
    .map(([group, count]) => ({ group, count, tone: GROUP_TONE_BY_NAME[group] ?? "navy" }))
    .sort((a, b) => b.count - a.count);

  const topCategories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count, tone: toneForCategory(category) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topCompanies = [...companyCounts.entries()]
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalClients: clientCreatedAt.length,
    totalDocuments: documents.length,
    documentsLast30Days,
    topCategory: topCategories[0]?.category ?? null,
    monthlySubmissions,
    categoryGroups,
    topCategories,
    topCompanies,
    monthlyClients,
    monthlyCategoryGroups,
    monthlyTable,
    monthlyDetails,
  };
}
