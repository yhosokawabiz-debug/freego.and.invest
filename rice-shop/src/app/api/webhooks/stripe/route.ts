import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { newOrderNumber } from "@/lib/order-number";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 同じイベントの再送は無視
  const seen = await prisma.processedEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true });

  switch (event.type) {
    case "payment_intent.succeeded":
      await onPaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.requires_action":
    case "payment_intent.processing":
      // コンビニ払込票の発行・銀行振込の振込先案内など、入金待ちの状態
      await recordPaymentMethod(event.data.object);
      break;
    case "payment_intent.canceled":
      await markFailed(event.data.object.metadata.orderId);
      break;
    case "invoice.paid":
      await onInvoicePaid(event.data.object);
      break;
    case "customer.subscription.deleted":
      console.info("subscription canceled", event.data.object.id);
      break;
  }

  await prisma.processedEvent.create({ data: { id: event.id } });
  return NextResponse.json({ received: true });
}

async function paymentMethodType(pi: Stripe.PaymentIntent): Promise<string | null> {
  if (!pi.payment_method) return null;
  if (typeof pi.payment_method !== "string") return pi.payment_method.type;
  return (await stripe().paymentMethods.retrieve(pi.payment_method)).type;
}

async function recordPaymentMethod(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata.orderId;
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["pending", "awaiting_payment"] } },
    data: { paymentMethod: await paymentMethodType(pi) },
  });
}

async function onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  // 定期便の PaymentIntent は metadata を持たないので invoice.paid 側で処理する
  const orderId = pi.metadata.orderId;
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === "paid") return;
  if (pi.amount_received !== order.total) {
    console.error("amount mismatch", order.orderNumber, pi.amount_received, order.total);
    return;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "paid", paymentMethod: await paymentMethodType(pi) },
  });
}

async function markFailed(orderId: string | undefined) {
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["pending", "awaiting_payment"] } },
    data: { status: "failed" },
  });
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details;
  const orderId = details?.metadata?.orderId;
  if (!details || !orderId) return;

  if (invoice.billing_reason === "subscription_create") {
    await prisma.order.updateMany({
      where: { id: orderId, status: { not: "paid" } },
      data: { status: "paid", paymentMethod: "card" },
    });
    return;
  }

  if (invoice.billing_reason !== "subscription_cycle") return;

  // 2 回目以降のお届け: 初回注文から定期便の商品だけを引き継いで新しい注文を作る
  const existing = await prisma.order.findFirst({ where: { paymentReference: invoice.id } });
  if (existing) return;
  const original = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!original) return;
  const items = original.items.filter((i) => i.purchaseType !== "once");
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  if (subtotal !== invoice.amount_paid) {
    console.error("subscription renewal amount mismatch", invoice.id, subtotal, invoice.amount_paid);
  }

  const { id: _id, orderNumber: _n, createdAt: _c, updatedAt: _u, items: _i, ...rest } = original;
  await prisma.order.create({
    data: {
      ...rest,
      orderNumber: newOrderNumber(),
      status: "paid",
      paymentReference: invoice.id,
      subtotal,
      shippingFee: 0,
      total: invoice.amount_paid,
      deliveryDate: null, // 定期便 2 回目以降は最短お届け
      items: {
        create: items.map(({ id: _iid, orderId: _oid, ...item }) => item),
      },
    },
  });
}
