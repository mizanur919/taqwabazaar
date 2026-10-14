/** "Apple iPhone 13 Pro!" → "apple-iphone-13-pro". Non-latin text (Bangla) is dropped. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 180);
