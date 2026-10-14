// Browser side of the Facebook Pixel. Components call track(); events raised before the Pixel is
// initialized (child effects run before the layout's) wait in a small queue instead of being lost.
import { trackMetaEvent } from "@/app/actions";

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "AddToWishlist"
  | "InitiateCheckout"
  | "Purchase"
  | "Contact";

export type MetaContent = { id: string; quantity: number; item_price: number };

export type MetaEventData = {
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  content_type?: "product";
  contents?: MetaContent[];
  value?: number;
  currency?: "BDT";
  num_items?: number;
  search_string?: string;
  order_id?: string;
};

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...a: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let state: "waiting" | "on" | "off" = "waiting";
let serverEvents = false;
let queue: [MetaEventName, MetaEventData, TrackOptions][] = [];

type TrackOptions = { eventId?: string; /** also send through the Conversions API (default true) */ server?: boolean };

export const newEventId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Facebook's standard loader: a stub that queues calls, plus the async fbevents.js script. */
function loadFbq() {
  if (window.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  // <MetaPixel> sends one PageView per client-side navigation itself, so fbevents.js must not add
  // its own on history changes, nor drop ours as a "duplicate" of the first page's PageView.
  n.disablePushState = true;
  n.allowDuplicatePageViews = true;
  window.fbq = window._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
}

/** Called once by <MetaPixel>; a null pixelId turns tracking off and drops anything queued. */
export function initPixel(pixelId: string | null, capi: boolean) {
  if (state !== "waiting") return;
  if (!pixelId) {
    state = "off";
    queue = [];
    return;
  }
  loadFbq();
  window.fbq!("init", pixelId);
  state = "on";
  serverEvents = capi;
  const pending = queue;
  queue = [];
  for (const [name, data, opts] of pending) send(name, data, opts);
}

function send(name: MetaEventName, data: MetaEventData, opts: TrackOptions) {
  const eventId = opts.eventId ?? newEventId();
  window.fbq?.("track", name, data, { eventID: eventId });
  // same event_id on both sides, so Meta counts the event once
  if (serverEvents && opts.server !== false) {
    trackMetaEvent({ name, eventId, data, url: window.location.href }).catch(() => {});
  }
}

export function track(name: MetaEventName, data: MetaEventData = {}, opts: TrackOptions = {}) {
  if (typeof window === "undefined" || state === "off") return;
  if (state === "waiting") {
    if (queue.length < 30) queue.push([name, data, opts]);
    return;
  }
  send(name, data, opts);
}

/** content fields for a list of cart-like lines */
export function contentsOf(lines: { id: number; qty: number; price: number }[]): MetaEventData {
  return {
    content_type: "product",
    content_ids: [...new Set(lines.map((l) => String(l.id)))],
    contents: lines.map((l) => ({ id: String(l.id), quantity: l.qty, item_price: l.price })),
    num_items: lines.reduce((n, l) => n + l.qty, 0),
    value: lines.reduce((n, l) => n + l.price * l.qty, 0),
    currency: "BDT",
  };
}
