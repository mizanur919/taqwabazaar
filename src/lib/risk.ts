// Fraud risk levels and their look; safe to import from client components.

export type RiskLevel = "safe" | "caution" | "risky" | "new" | "blocked";

export const riskMeta: Record<RiskLevel, { label: string; dot: string; className: string }> = {
  safe: { label: "নিরাপদ", dot: "🟢", className: "bg-green-100 text-green-800" },
  caution: { label: "সতর্ক থাকুন", dot: "🟡", className: "bg-amber-100 text-amber-900" },
  risky: { label: "ঝুঁকিপূর্ণ", dot: "🔴", className: "bg-red-100 text-red-800" },
  new: { label: "নতুন কাস্টমার", dot: "⚪", className: "bg-stone-100 text-stone-700" },
  blocked: { label: "ব্লক করা", dot: "⛔", className: "bg-red-600 text-white" },
};

export const isRiskLevel = (v: unknown): v is RiskLevel => typeof v === "string" && v in riskMeta;
