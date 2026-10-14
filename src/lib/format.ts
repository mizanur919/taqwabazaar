const bnDigits = "০১২৩৪৫৬৭৮৯";

export const toBnDigits = (value: string | number) =>
  String(value).replace(/\d/g, (d) => bnDigits[Number(d)]);

/** ৳1,790 — prices stay in English digits like the reference site. */
export const taka = (amount: number) => `৳${Math.round(amount).toLocaleString("en-IN")}`;
