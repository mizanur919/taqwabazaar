import type { MenuBadge } from "@/lib/layout";

const badgeStyle: Record<Exclude<MenuBadge, "">, { text: string; className: string }> = {
  hot: { text: "Hot", className: "bg-red-600" },
  new: { text: "New", className: "bg-green-600" },
  sale: { text: "Sale", className: "bg-brand" },
};

export function MenuBadgePill({ badge }: { badge: MenuBadge }) {
  if (!badge) return null;
  const b = badgeStyle[badge];
  return <span className={`rounded px-1 py-px text-[9px] font-bold uppercase leading-none text-white ${b.className}`}>{b.text}</span>;
}
