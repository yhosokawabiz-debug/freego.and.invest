import { describe, expect, it } from "vitest";
import { CartError, getProduct, quoteCart, unitPrice, type CartLine } from "./catalog";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  productSlug: "niigata-koshihikari",
  weightKg: 5,
  polish: "white",
  purchaseType: "once",
  quantity: 1,
  ...over,
});

describe("unitPrice", () => {
  const product = getProduct("niigata-koshihikari")!;

  it("5kg 白米は 1kg 単価 × 5", () => {
    expect(unitPrice(product, 5, "white", "once")).toBe(4500);
  });

  it("定期便は 5% 引きで 10 円単位に丸める", () => {
    expect(unitPrice(product, 5, "white", "monthly")).toBe(4280);
  });
});

describe("quoteCart", () => {
  it("5,000 円未満の通常購入は送料 990 円", () => {
    const q = quoteCart([line()]);
    expect(q.shippingFee).toBe(990);
    expect(q.total).toBe(q.subtotal + 990);
  });

  it("5,000 円以上は送料無料", () => {
    expect(quoteCart([line({ quantity: 2 })]).shippingFee).toBe(0);
  });

  it("定期便を含めば送料無料", () => {
    const q = quoteCart([line({ weightKg: 2, purchaseType: "monthly" })]);
    expect(q.shippingFee).toBe(0);
    expect(q.subscriptionInterval).toBe("monthly");
  });

  it("毎月と隔月の混在はエラー", () => {
    expect(() => quoteCart([line({ purchaseType: "monthly" }), line({ purchaseType: "bimonthly" })])).toThrow(CartError);
  });

  it("存在しない商品・容量・精米方法・数量はエラー", () => {
    expect(() => quoteCart([line({ productSlug: "nope" })])).toThrow(CartError);
    expect(() => quoteCart([line({ weightKg: 3 })])).toThrow(CartError);
    expect(() => quoteCart([line({ productSlug: "yamagata-tsuyahime", polish: "7bu" })])).toThrow(CartError);
    expect(() => quoteCart([line({ quantity: 0 })])).toThrow(CartError);
  });
});
