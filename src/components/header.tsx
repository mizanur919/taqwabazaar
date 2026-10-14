import Link from "next/link";
import { getCategories } from "@/lib/catalog";
import { HeaderIcons } from "./header-icons";
import { SearchBox } from "./search-box";

export function Logo() {
  return (
    <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-ink">
      Taqwa<span className="text-brand">Bazaar</span>
    </Link>
  );
}

export async function Header({ phone }: { phone: string }) {
  const categories = await getCategories();
  const navCategories = categories.filter((c) => c.productCount > 0).slice(0, 5);

  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="bg-ink text-xs text-white">
        <div className="mx-auto flex max-w-7xl justify-end gap-3 px-4 py-1.5">
          <span>Cash On Delivery</span>
          <span className="opacity-50">|</span>
          <span>24/7 Support</span>
          <span className="hidden opacity-50 sm:inline">|</span>
          <a href={`tel:${phone}`} className="hidden sm:inline">
            {phone}
          </a>
        </div>
      </div>

      <div className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <div className="mx-auto hidden w-full max-w-xl md:block">
            <SearchBox />
          </div>
          <HeaderIcons />
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </div>

      <nav className="border-b border-line">
        <ul className="no-scrollbar mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 text-sm font-semibold whitespace-nowrap md:justify-center">
          <li>
            <Link href="/" className="hover:text-brand">Home</Link>
          </li>
          <li>
            <Link href="/category/all" className="hover:text-brand">All Products</Link>
          </li>
          {navCategories.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="hover:text-brand">
                {c.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/track-order" className="hover:text-brand">অর্ডার ট্র্যাকিং</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
