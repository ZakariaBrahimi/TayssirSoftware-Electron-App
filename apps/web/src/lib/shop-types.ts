/*
 * Kinds of shop. Chosen at sign-up: it creates starter categories in the
 * owner's language and adapts a few defaults (e.g. clothing shops create
 * products with sizes and colours first). It can be changed in Settings.
 */

export const SHOP_TYPES = [
  "supermarket",
  "fashion",
  "phones",
  "cosmetics",
  "hardware",
  "stationery",
  "general",
] as const;
export type ShopType = (typeof SHOP_TYPES)[number];

export const isShopType = (v: unknown): v is ShopType =>
  typeof v === "string" && (SHOP_TYPES as readonly string[]).includes(v);

/** Shops whose products mostly come in sizes/colours. */
export const usesVariants = (type: string | null | undefined) => type === "fashion";

type Names = { en: string; fr: string; ar: string };
const c = (en: string, fr: string, ar: string): Names => ({ en, fr, ar });

const STARTER_CATEGORIES: Record<ShopType, Names[]> = {
  supermarket: [
    c("Fruits & vegetables", "Fruits et légumes", "خضر وفواكه"),
    c("Dairy & eggs", "Produits laitiers et œufs", "حليب ومشتقاته وبيض"),
    c("Grocery", "Épicerie", "مواد غذائية"),
    c("Drinks", "Boissons", "مشروبات"),
    c("Bakery", "Boulangerie", "مخبزة"),
    c("Meat & poultry", "Viandes et volailles", "لحوم ودواجن"),
    c("Cleaning & home", "Entretien et maison", "تنظيف ومنزل"),
    c("Hygiene", "Hygiène", "نظافة شخصية"),
  ],
  fashion: [
    c("Men", "Homme", "رجال"),
    c("Women", "Femme", "نساء"),
    c("Kids", "Enfants", "أطفال"),
    c("Shoes", "Chaussures", "أحذية"),
    c("Accessories", "Accessoires", "إكسسوارات"),
  ],
  phones: [
    c("Phones", "Téléphones", "هواتف"),
    c("Tablets", "Tablettes", "لوحات إلكترونية"),
    c("Accessories", "Accessoires", "إكسسوارات"),
    c("Chargers & cables", "Chargeurs et câbles", "شواحن وكوابل"),
    c("Audio", "Audio", "سماعات"),
    c("Repairs & services", "Réparations et services", "تصليح وخدمات"),
  ],
  cosmetics: [
    c("Skin care", "Soins de la peau", "العناية بالبشرة"),
    c("Make-up", "Maquillage", "مكياج"),
    c("Perfumes", "Parfums", "عطور"),
    c("Hair care", "Soins capillaires", "العناية بالشعر"),
    c("Hygiene", "Hygiène", "نظافة شخصية"),
  ],
  hardware: [
    c("Tools", "Outillage", "أدوات"),
    c("Electricity", "Électricité", "كهرباء"),
    c("Plumbing", "Plomberie", "ترصيص"),
    c("Paint", "Peinture", "دهان"),
    c("Screws & fixings", "Visserie et fixations", "براغي ومثبتات"),
  ],
  stationery: [
    c("School supplies", "Fournitures scolaires", "أدوات مدرسية"),
    c("Office", "Bureau", "مستلزمات مكتبية"),
    c("Books", "Livres", "كتب"),
    c("Printing & copies", "Impression et copies", "طباعة ونسخ"),
  ],
  general: [],
};

export function starterCategories(type: ShopType, locale: string) {
  const lang = locale === "fr" || locale === "ar" ? locale : "en";
  return STARTER_CATEGORIES[type].map((n) => n[lang]);
}
