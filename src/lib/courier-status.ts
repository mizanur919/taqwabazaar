// Courier status names in Bangla; safe to import from client components.

export const courierStatusLabels: Record<string, string> = {
  in_review: "রিভিউতে",
  pending: "পথে আছে",
  hold: "হোল্ডে",
  delivered_approval_pending: "ডেলিভারি হয়েছে (অনুমোদন বাকি)",
  partial_delivered_approval_pending: "আংশিক ডেলিভারি (অনুমোদন বাকি)",
  cancelled_approval_pending: "বাতিল (অনুমোদন বাকি)",
  unknown_approval_pending: "অজানা (অনুমোদন বাকি)",
  delivered: "ডেলিভারি হয়েছে",
  partial_delivered: "আংশিক ডেলিভারি",
  cancelled: "বাতিল / ফেরত",
  unknown: "অজানা, Steadfast-এ যোগাযোগ করুন",
};

export const isCourierReturn = (s: string | null) => !!s && s.startsWith("cancelled");
