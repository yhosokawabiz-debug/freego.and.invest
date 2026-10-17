import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY が未設定です");
    client = new Stripe(key);
  }
  return client;
}

/** 商品ごとの Stripe Product を（無ければ）作成して ID を返す */
export async function ensureStripeProduct(slug: string, name: string): Promise<string> {
  const id = `rice_${slug}`;
  try {
    await stripe().products.retrieve(id);
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeInvalidRequestError) || err.code !== "resource_missing") throw err;
    await stripe().products.create({ id, name });
  }
  return id;
}
