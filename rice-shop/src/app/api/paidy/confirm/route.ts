import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { paidy } from "@/lib/paidy";

const bodySchema = z.object({ orderId: z.string().min(1), paymentId: z.string().regex(/^pay_[A-Za-z0-9_-]+$/) });

/** paidy.js で承認された決済を検証して売上確定（capture）する */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  const { orderId, paymentId } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentProvider !== "paidy") {
    return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
  }
  if (order.status === "paid") return NextResponse.json({ orderId });
  if (order.status !== "pending") return NextResponse.json({ error: "この注文は決済できません" }, { status: 409 });

  const payment = await paidy.retrieve(paymentId);
  const matches =
    payment.status === "authorized" &&
    payment.amount === order.total &&
    payment.currency === "JPY" &&
    payment.order.order_ref === order.orderNumber;
  if (!matches) {
    console.error("paidy payment mismatch", order.orderNumber, payment);
    if (payment.status === "authorized") await paidy.close(paymentId);
    await prisma.order.update({ where: { id: order.id }, data: { status: "failed", paymentReference: paymentId } });
    return NextResponse.json({ error: "決済内容が注文と一致しません" }, { status: 409 });
  }

  await paidy.capture(paymentId);
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "paid", paymentMethod: "paidy", paymentReference: paymentId },
  });
  return NextResponse.json({ orderId });
}
