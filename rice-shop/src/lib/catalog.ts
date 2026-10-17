// 商品マスタと価格計算。価格はすべて税込（米は軽減税率 8% 対象）。
// 金額はクライアントから受け取らず、必ずここでサーバー側計算する。

export type Polish = "white" | "musenmai" | "7bu" | "5bu" | "brown";
export type PurchaseType = "once" | "monthly" | "bimonthly";

export type Product = {
  slug: string;
  name: string;
  origin: string;
  harvestYear: number;
  description: string;
  pricePerKg: number; // 白米 5kg 基準の 1kg あたり税込価格
  weights: number[];
  polishes: Polish[];
  inStock: boolean;
};

export const POLISH_LABELS: Record<Polish, string> = {
  white: "白米",
  musenmai: "無洗米",
  "7bu": "7分づき",
  "5bu": "5分づき",
  brown: "玄米",
};

// 精米加工の 1kg あたり加算額
const POLISH_SURCHARGE_PER_KG: Record<Polish, number> = {
  white: 0,
  musenmai: 40,
  "7bu": 0,
  "5bu": 0,
  brown: -30,
};

// 容量ごとの単価係数（小容量は割高、大容量は割安）
const WEIGHT_FACTOR: Record<number, number> = { 2: 1.1, 5: 1.0, 10: 0.95 };

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  once: "通常購入",
  monthly: "定期便（毎月）",
  bimonthly: "定期便（隔月）",
};

export const SUBSCRIPTION_DISCOUNT = 0.05;
export const SHIPPING_FEE = 990;
export const FREE_SHIPPING_THRESHOLD = 5000;
export const NP_ATOBARAI_LIMIT = 55000;

export const PRODUCTS: Product[] = [
  {
    slug: "niigata-koshihikari",
    name: "新潟県産コシヒカリ",
    origin: "新潟県魚沼地区",
    harvestYear: 2026,
    description: "強い粘りと甘み、艶のある炊き上がり。冷めても美味しく、お弁当にも最適です。",
    pricePerKg: 900,
    weights: [2, 5, 10],
    polishes: ["white", "musenmai", "7bu", "5bu", "brown"],
    inStock: true,
  },
  {
    slug: "yamagata-tsuyahime",
    name: "山形県産つや姫",
    origin: "山形県庄内地方",
    harvestYear: 2026,
    description: "名前の通り輝くような白さと、上品な甘み。粒がしっかりしていて和食によく合います。",
    pricePerKg: 850,
    weights: [2, 5, 10],
    polishes: ["white", "musenmai", "brown"],
    inStock: true,
  },
  {
    slug: "akita-akitakomachi",
    name: "秋田県産あきたこまち",
    origin: "秋田県大潟村",
    harvestYear: 2026,
    description: "あっさりとした食感と程よい粘り。毎日食べても飽きのこない定番のお米です。",
    pricePerKg: 750,
    weights: [2, 5, 10],
    polishes: ["white", "musenmai", "7bu", "5bu", "brown"],
    inStock: true,
  },
  {
    slug: "hokkaido-nanatsuboshi",
    name: "北海道産ななつぼし",
    origin: "北海道空知地方",
    harvestYear: 2026,
    description: "粘りと甘みのバランスが良く、冷めても硬くなりにくい。お寿司やチャーハンにも。",
    pricePerKg: 700,
    weights: [2, 5, 10],
    polishes: ["white", "musenmai", "brown"],
    inStock: true,
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** 1袋あたりの税込価格 */
export function unitPrice(product: Product, weightKg: number, polish: Polish, purchaseType: PurchaseType): number {
  const factor = WEIGHT_FACTOR[weightKg] ?? 1;
  const base = (product.pricePerKg + POLISH_SURCHARGE_PER_KG[polish]) * weightKg * factor;
  const discounted = purchaseType === "once" ? base : base * (1 - SUBSCRIPTION_DISCOUNT);
  return roundTo10(discounted);
}

export type CartLine = {
  productSlug: string;
  weightKg: number;
  polish: Polish;
  purchaseType: PurchaseType;
  quantity: number;
};

export type PricedLine = CartLine & { productName: string; unitPrice: number; lineTotal: number };

export type Quote = {
  lines: PricedLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  subscriptionInterval: "monthly" | "bimonthly" | null;
};

export class CartError extends Error {}

/** カートを検証して金額を確定する（サーバー・クライアント共通） */
export function quoteCart(cart: CartLine[]): Quote {
  if (cart.length === 0) throw new CartError("カートが空です");

  const lines: PricedLine[] = cart.map((line) => {
    const product = getProduct(line.productSlug);
    if (!product) throw new CartError("存在しない商品が含まれています");
    if (!product.inStock) throw new CartError(`${product.name} は在庫切れです`);
    if (!product.weights.includes(line.weightKg)) throw new CartError("選択できない容量です");
    if (!product.polishes.includes(line.polish)) throw new CartError("選択できない精米方法です");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new CartError("数量は 1〜20 で指定してください");
    }
    const price = unitPrice(product, line.weightKg, line.polish, line.purchaseType);
    return { ...line, productName: product.name, unitPrice: price, lineTotal: price * line.quantity };
  });

  // Stripe の 1 サブスクリプションは請求周期を 1 つしか持てないため混在不可
  const intervals = new Set(lines.filter((l) => l.purchaseType !== "once").map((l) => l.purchaseType));
  if (intervals.size > 1) throw new CartError("毎月と隔月の定期便は別々にご注文ください");
  const subscriptionInterval = (intervals.values().next().value ?? null) as Quote["subscriptionInterval"];

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  // 定期便を含む注文、または 5,000 円以上は送料無料
  const shippingFee = subscriptionInterval || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return { lines, subtotal, shippingFee, total: subtotal + shippingFee, subscriptionInterval };
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
