import type { Metadata } from "next";
import { Hind_Siliguri } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "600", "700"], // each weight is two font files (Bangla + Latin); 500 maps to 600 in globals.css
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} - ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the admin theme script sets data attributes on <html> before hydration
    <html lang="bn" className={`${hind.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
