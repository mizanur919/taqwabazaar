import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const btn = "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-xs font-semibold";
  return (
    <nav aria-label="পেজ" className="flex items-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} scroll={false} aria-label="আগের পেজ" className={`${btn} border-adm-line bg-white hover:bg-stone-50`}>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={`${btn} border-adm-line bg-white opacity-40`}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pageList(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-adm-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            scroll={false}
            aria-current={p === page ? "page" : undefined}
            className={`${btn} ${p === page ? "border-adm-ink bg-adm-ink text-white" : "border-adm-line bg-white hover:bg-stone-50"}`}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} scroll={false} aria-label="পরের পেজ" className={`${btn} border-adm-line bg-white hover:bg-stone-50`}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={`${btn} border-adm-line bg-white opacity-40`}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
