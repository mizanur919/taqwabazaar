// Dashboard look (accent + light/dark) is a per-browser preference kept in localStorage.
// Lives outside the "use client" component so the admin layout (a server component) can inline the script.
export const THEME_KEY = "tb_admin_theme";

/** Runs before the first paint (inline in the admin layout) so the page never flashes the wrong colours. */
export const themeBootScript = `try{var t=JSON.parse(localStorage.getItem("${THEME_KEY}")||"{}");var r=document.documentElement;r.dataset.admAccent=t.accent||"amber";var d=t.mode==="dark"||(t.mode==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.admMode=d?"dark":"light"}catch(e){}`;
