import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { CartError, quoteCart, type Quote } from "@/lib/catalog";
import { checkoutSchema, isValidDeliveryDate, type CheckoutInput } from "@/lib/checkout-schema";
import { prisma } from "@/lib/db";
import { isNpAtobaraiConfigured, registerTransaction } from "@/lib/np-atobarai";
import { newOrderNumber } from "@/lib/order-number";
import { unavailableReason } from "@/lib/payment-methods";
import { ensureStripeProduct, stripe } from "@/lib/stripe";

type OrderWithItems = NonNullable<Awaited<ReturnType<typeof findOrder>>>;
const findOrder = (id: string) => prisma.order.findUnique({ where: { id }, include: { items: true } });

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(req: Request) {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
  const input = parsed.data;

  let quote: Quote;
  try {
    quote = quoteCart(input.cart);
  } catch (err) {
    if (err instanceof CartError) return badRequest(err.message);
    throw err;
  }
  if (input.deliveryDate && !isValidDeliveryDate(input.deliveryDate)) {
    return badRequest("お届け希望日が選択可能な範囲外です");
  }
  const reason = unavailableReason(input.payment, quote);
  if (reason) return badRequest(reason);
  if (input.payment === "np_atobarai" && !isNpAtobaraiConfigured()) {
    return NextResponse.json({ error: "NP後払いは現在ご利用いただけません" }, { status: 503 });
  }

  const order = await createOrder(input, quote);

  try {
    switch (input.payment) {
      case "stripe":
        return NextResponse.json(
          quote.subscriptionInterval ? await startStripeSubscription(order, quote) : await startStripePayment(order),
        );
      case "paidy":
        return NextResponse.json({ orderId: order.id, paidy: paidyCheckoutPayload(order) });
      case "np_atobarai":
        return NextResponse.json(await startNpAtobarai(order));
    }
  } catch (err) {
    console.error("checkout failed", order.orderNumber, err);
    await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
    return NextResponse.json({ error: "決済の準備に失敗しました。時間をおいて再度お試しください" }, { status: 502 });
  }
}

async function createOrder(input: CheckoutInput, quote: Quote): Promise<OrderWithItems> {
  const { customer } = input;
  return prisma.order.create({
    data: {
      orderNumber: newOrderNumber(),
      paymentProvider: input.payment,
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      total: quote.total,
      customerName: customer.name,
      customerKana: customer.kana,
      email: customer.email,
      phone: customer.phone,
      postalCode: customer.postalCode,
      prefecture: customer.prefecture,
      city: customer.city,
      address1: customer.address1,
      address2: customer.address2 || null,
      deliveryDate: input.deliveryDate,
      deliveryTimeSlot: input.deliveryTimeSlot,
      note: input.note || null,
      items: {
        create: quote.lines.map((l) => ({
          productSlug: l.productSlug,
          productName: l.productName,
          weightKg: l.weightKg,
          polish: l.polish,
          purchaseType: l.purchaseType,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      },
    },
    include: { items: true },
  });
}

function stripeShipping(order: OrderWithItems): Stripe.PaymentIntentCreateParams.Shipping {
  return {
    name: order.customerName,
    phone: order.phone,
    address: {
      country: "JP",
      postal_code: order.postalCode,
      state: order.prefecture,
      city: order.city,
      line1: order.address1,
      line2: order.address2 ?? undefined,
    },
  };
}

async function createStripeCustomer(order: OrderWithItems): Promise<Stripe.Customer> {
  const shipping = stripeShipping(order);
  return stripe().customers.create(
    {
      name: order.customerName,
      email: order.email,
      phone: order.phone,
      address: shipping.address,
      shipping: { name: shipping.name, phone: shipping.phone, address: shipping.address },
      metadata: { kana: order.customerKana },
    },
    { idempotencyKey: `customer-${order.id}` },
  );
}

/** 通常購入: PaymentIntent を作成。表示される支払い方法は Dashboard の設定に従う */
async function startStripePayment(order: OrderWithItems) {
  // 銀行振込（customer_balance）は Customer が必須
  const customer = await createStripeCustomer(order);
  const pi = await stripe().paymentIntents.create(
    {
      amount: order.total,
      currency: "jpy",
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      payment_method_options: {
        konbini: { expires_after_days: 3 },
        customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "jp_bank_transfer" } },
      },
      receipt_email: order.email,
      shipping: stripeShipping(order),
      description: `ご注文 ${order.orderNumber}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    },
    { idempotencyKey: `pi-${order.id}` },
  );
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentReference: pi.id, stripeCustomerId: customer.id, status: "awaiting_payment" },
  });
  return { orderId: order.id, mode: "payment", clientSecret: pi.client_secret };
}

/** 定期便: Subscription を作成し、初回請求書の PaymentIntent で決済する */
async function startStripeSubscription(order: OrderWithItems, quote: Quote) {
  const customer = await createStripeCustomer(order);
  const intervalCount = quote.subscriptionInterval === "bimonthly" ? 2 : 1;

  const recurring = quote.lines.filter((l) => l.purchaseType !== "once");
  const oneTime = quote.lines.filter((l) => l.purchaseType === "once");
  const productIds = new Map<string, string>();
  for (const l of quote.lines) {
    if (!productIds.has(l.productSlug)) productIds.set(l.productSlug, await ensureStripeProduct(l.productSlug, l.productName));
  }

  const subscription = await stripe().subscriptions.create(
    {
      customer: customer.id,
      items: recurring.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "jpy",
          product: productIds.get(l.productSlug)!,
          unit_amount: l.unitPrice,
          recurring: { interval: "month", interval_count: intervalCount },
        },
        metadata: { weightKg: String(l.weightKg), polish: l.polish },
      })),
      // 同梱する通常購入の商品は初回請求のみに加算
      add_invoice_items: oneTime.map((l) => ({
        quantity: l.quantity,
        price_data: { currency: "jpy", product: productIds.get(l.productSlug)!, unit_amount: l.unitPrice },
        metadata: { weightKg: String(l.weightKg), polish: l.polish },
      })),
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      expand: ["latest_invoice.confirmation_secret"],
    },
    { idempotencyKey: `sub-${order.id}` },
  );

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  if (invoice.total !== order.total) {
    throw new Error(`invoice total mismatch: ${invoice.total} != ${order.total}`);
  }
  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      paymentReference: invoice.id,
      status: "awaiting_payment",
    },
  });
  return { orderId: order.id, mode: "subscription", clientSecret: invoice.confirmation_secret?.client_secret };
}

/** paidy.js に渡すペイロード。金額はサーバーで確定させたものを使う */
function paidyCheckoutPayload(order: OrderWithItems) {
  return {
    amount: order.total,
    currency: "JPY",
    store_name: "FREEGO お米のオンラインショップ",
    buyer: {
      email: order.email,
      name1: order.customerName,
      name2: order.customerKana,
      phone: order.phone,
    },
    order: {
      order_ref: order.orderNumber,
      items: order.items.map((i) => ({
        id: `${i.productSlug}-${i.weightKg}kg-${i.polish}`,
        title: `${i.productName} ${i.weightKg}kg`,
        quantity: i.quantity,
        unit_price: i.unitPrice,
      })),
      shipping: order.shippingFee,
    },
    shipping_address: {
      line1: order.address2 ?? "",
      line2: order.address1,
      city: order.city,
      state: order.prefecture,
      zip: `${order.postalCode.slice(0, 3)}-${order.postalCode.slice(3)}`,
    },
  };
}

async function startNpAtobarai(order: OrderWithItems) {
  const result = await registerTransaction(order);
  if (result.result === "ng") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
    return { orderId: order.id, error: "NP後払いの審査が通りませんでした。他のお支払い方法をお選びください" };
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "awaiting_payment", paymentMethod: "np_atobarai", paymentReference: result.transactionId },
  });
  return { orderId: order.id, mode: "np_atobarai" };
}
