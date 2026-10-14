// Brand constants and the DEFAULT values for admin-editable settings.
// Contact details, delivery fees and page text are edited in Admin → Settings (see src/lib/settings.ts).
export const site = {
  name: "TaqwaBazaar",
  tagline: "বাংলাদেশের বিশ্বস্ত গ্যাজেট শপ",
  description:
    "TaqwaBazaar - বাংলাদেশের বিশ্বস্ত অনলাইন গ্যাজেট শপ। অরিজিনাল প্রোডাক্ট, সেরা দাম আর সারা দেশে ক্যাশ অন ডেলিভারি।",
  phone: "01XXXXXXXXX",
  whatsapp: "8801XXXXXXXXX", // international format, digits only
  email: "info@taqwabazaar.com",
  address: "ঢাকা, বাংলাদেশ",
};

export const deliveryZones = [
  { id: "outside", label: "ঢাকার বাহিরে", fee: 120 },
  { id: "inside", label: "ঢাকার ভিতরে", fee: 70 },
] as const;

export type DeliveryZoneId = (typeof deliveryZones)[number]["id"];

export const staticPages: Record<string, { title: string; body: string[] }> = {
  "about-us": {
    title: "আমাদের সম্পর্কে",
    body: [
      "TaqwaBazaar একটি বাংলাদেশি অনলাইন গ্যাজেট শপ। আমরা অরিজিনাল মোবাইল, ল্যাপটপ, ইয়ারবাড, স্মার্টওয়াচ এবং প্রয়োজনীয় এক্সেসরিজ সঠিক দামে আপনার দোরগোড়ায় পৌঁছে দিই।",
      "সততা ও বিশ্বস্ততা আমাদের মূলনীতি। প্রতিটি পণ্য যাচাই করে পাঠানো হয় এবং সারা দেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।",
    ],
  },
  "privacy-policy": {
    title: "প্রাইভেসি পলিসি",
    body: [
      "অর্ডার প্রসেস করার জন্য আমরা শুধুমাত্র আপনার নাম, মোবাইল নম্বর ও ঠিকানা সংগ্রহ করি।",
      "আপনার তথ্য কখনো তৃতীয় পক্ষের কাছে বিক্রি বা শেয়ার করা হয় না, শুধুমাত্র ডেলিভারি পার্টনারকে পণ্য পৌঁছানোর জন্য প্রয়োজনীয় তথ্য দেওয়া হয়।",
    ],
  },
  "refund-policy": {
    title: "রিফান্ড পলিসি",
    body: [
      "পণ্য হাতে পাওয়ার সময় ডেলিভারি ম্যানের সামনে চেক করে নিন। ত্রুটিপূর্ণ বা ভুল পণ্য পেলে ৭ দিনের মধ্যে রিটার্ন করা যাবে।",
      "রিটার্ন অনুমোদিত হলে ৩-৭ কর্মদিবসের মধ্যে বিকাশ/নগদ বা ব্যাংকের মাধ্যমে টাকা ফেরত দেওয়া হবে।",
    ],
  },
  "contact-us": {
    title: "যোগাযোগ",
    // phone, email and address are shown automatically from Admin → Settings → Store
    body: ["সকাল ১০টা থেকে রাত ১০টা পর্যন্ত আমরা কল ও মেসেজের উত্তর দিই।"],
  },
};
