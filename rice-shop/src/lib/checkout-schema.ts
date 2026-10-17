import { z } from "zod";

export const cartLineSchema = z.object({
  productSlug: z.string().min(1).max(100),
  weightKg: z.number().int(),
  polish: z.enum(["white", "musenmai", "7bu", "5bu", "brown"]),
  purchaseType: z.enum(["once", "monthly", "bimonthly"]),
  quantity: z.number().int(),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(60),
  kana: z
    .string()
    .trim()
    .min(1, "フリガナを入力してください")
    .max(60)
    .regex(/^[ァ-ヶー\s　]+$/, "フリガナは全角カタカナで入力してください"),
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9,10}$/, "電話番号はハイフンなしの半角数字で入力してください"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{7}$/, "郵便番号はハイフンなしの7桁で入力してください"),
  prefecture: z.string().trim().min(1, "都道府県を選択してください"),
  city: z.string().trim().min(1, "市区町村を入力してください").max(100),
  address1: z.string().trim().min(1, "番地を入力してください").max(100),
  address2: z.string().trim().max(100).optional().default(""),
});

export const checkoutSchema = z.object({
  cart: z.array(cartLineSchema).min(1).max(30),
  customer: customerSchema,
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deliveryTimeSlot: z.enum(["none", "am", "14-16", "16-18", "18-20", "19-21"]),
  note: z.string().max(500).optional().default(""),
  payment: z.enum(["stripe", "paidy", "np_atobarai"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const TIME_SLOT_LABELS: Record<CheckoutInput["deliveryTimeSlot"], string> = {
  none: "指定なし",
  am: "午前中",
  "14-16": "14〜16時",
  "16-18": "16〜18時",
  "18-20": "18〜20時",
  "19-21": "19〜21時",
};

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// 受注後に精米して発送するため、お届けは注文日の 3 日後〜14 日後から選べる
export const DELIVERY_MIN_DAYS = 3;
export const DELIVERY_MAX_DAYS = 14;

/** JST の日付 (YYYY-MM-DD) を n 日後にずらして返す */
export function jstDatePlus(days: number, now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 3600_000 + days * 86400_000);
  return jst.toISOString().slice(0, 10);
}

export function isValidDeliveryDate(date: string, now = new Date()): boolean {
  return date >= jstDatePlus(DELIVERY_MIN_DAYS, now) && date <= jstDatePlus(DELIVERY_MAX_DAYS, now);
}
