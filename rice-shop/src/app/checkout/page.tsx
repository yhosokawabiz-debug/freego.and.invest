"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useMemo, useState } from "react";
import { OrderSummary } from "@/components/OrderSummary";
import { cart, useCart } from "@/lib/cart-store";
import { CartError, quoteCart } from "@/lib/catalog";
import {
  DELIVERY_MAX_DAYS,
  DELIVERY_MIN_DAYS,
  PREFECTURES,
  TIME_SLOT_LABELS,
  jstDatePlus,
  type CheckoutInput,
} from "@/lib/checkout-schema";
import { PAYMENT_CHOICES, unavailableReason, type PaymentChoice } from "@/lib/payment-methods";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type PaidyCallback = { status: "authorized" | "rejected" | "closed"; id?: string };
declare global {
  interface Window {
    Paidy?: {
      configure(opts: { api_key: string; closed: (data: PaidyCallback) => void }): { launch(payload: unknown): void };
    };
  }
}

type Customer = CheckoutInput["customer"];
const emptyCustomer: Customer = {
  name: "", kana: "", email: "", phone: "", postalCode: "", prefecture: "", city: "", address1: "", address2: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart();
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<CheckoutInput["deliveryTimeSlot"]>("none");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentChoice>("stripe");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripeSession, setStripeSession] = useState<{ orderId: string; clientSecret: string } | null>(null);

  const quote = useMemo(() => {
    try {
      return lines.length ? quoteCart(lines) : null;
    } catch (err) {
      if (err instanceof CartError) return null;
      throw err;
    }
  }, [lines]);

  const dateOptions = useMemo(
    () => Array.from({ length: DELIVERY_MAX_DAYS - DELIVERY_MIN_DAYS + 1 }, (_, i) => jstDatePlus(DELIVERY_MIN_DAYS + i)),
    [],
  );

  if (!quote) {
    return <p>カートが空か、内容に問題があります。<a href="/cart">カートに戻る</a></p>;
  }

  const set = (key: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCustomer((c) => ({ ...c, [key]: e.target.value }));

  const finish = (orderId: string) => {
    cart.clear();
    router.push(`/checkout/complete?order=${encodeURIComponent(orderId)}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: CheckoutInput = {
        cart: lines,
        customer,
        deliveryDate: deliveryDate || null,
        deliveryTimeSlot: timeSlot,
        note,
        payment,
      };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "エラーが発生しました");

      if (payment === "stripe") {
        setStripeSession({ orderId: data.orderId, clientSecret: data.clientSecret });
      } else if (payment === "paidy") {
        launchPaidy(data.orderId, data.paidy);
      } else {
        finish(data.orderId);
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const launchPaidy = (orderId: string, payload: unknown) => {
    if (!window.Paidy) {
      setError("ペイディを読み込めませんでした。ページを再読み込みしてください");
      setSubmitting(false);
      return;
    }
    const handler = window.Paidy.configure({
      api_key: process.env.NEXT_PUBLIC_PAIDY_PUBLIC_KEY ?? "",
      closed: async (result) => {
        if (result.status !== "authorized" || !result.id) {
          setError(result.status === "rejected" ? "ペイディの審査が通りませんでした。他のお支払い方法をお選びください" : null);
          setSubmitting(false);
          return;
        }
        const res = await fetch("/api/paidy/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, paymentId: result.id }),
        });
        if (res.ok) finish(orderId);
        else {
          setError((await res.json()).error ?? "決済の確定に失敗しました");
          setSubmitting(false);
        }
      },
    });
    handler.launch(payload);
  };

  if (stripeSession) {
    return (
      <div className="two-col">
        <div className="card">
          <h2>お支払い</h2>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: stripeSession.clientSecret, locale: "ja", appearance: { variables: { colorPrimary: "#7a5c2e" } } }}
          >
            <StripePaymentForm orderId={stripeSession.orderId} />
          </Elements>
        </div>
        <OrderSummary quote={quote} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="two-col">
      <Script src="https://apps.paidy.com/" strategy="lazyOnload" />
      <div>
        <h1>ご購入手続き</h1>
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>お届け先</h2>
          <div className="row">
            <div className="field"><label htmlFor="name">お名前</label><input id="name" required value={customer.name} onChange={set("name")} autoComplete="name" /></div>
            <div className="field"><label htmlFor="kana">フリガナ</label><input id="kana" required value={customer.kana} onChange={set("kana")} placeholder="ヤマダ タロウ" /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="email">メールアドレス</label><input id="email" type="email" required value={customer.email} onChange={set("email")} autoComplete="email" /></div>
            <div className="field"><label htmlFor="phone">電話番号（ハイフンなし）</label><input id="phone" inputMode="tel" required value={customer.phone} onChange={set("phone")} autoComplete="tel" /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="postal">郵便番号（ハイフンなし）</label><input id="postal" inputMode="numeric" required value={customer.postalCode} onChange={set("postalCode")} autoComplete="postal-code" /></div>
            <div className="field">
              <label htmlFor="pref">都道府県</label>
              <select id="pref" required value={customer.prefecture} onChange={set("prefecture")} autoComplete="address-level1">
                <option value="">選択してください</option>
                {PREFECTURES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="city">市区町村</label><input id="city" required value={customer.city} onChange={set("city")} autoComplete="address-level2" /></div>
          <div className="field"><label htmlFor="addr1">番地</label><input id="addr1" required value={customer.address1} onChange={set("address1")} autoComplete="address-line1" /></div>
          <div className="field"><label htmlFor="addr2">建物名・部屋番号（任意）</label><input id="addr2" value={customer.address2} onChange={set("address2")} autoComplete="address-line2" /></div>
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <h2>お届け日時</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="date">お届け希望日</label>
              <select id="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}>
                <option value="">最短でお届け</option>
                {dateOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="slot">時間帯</label>
              <select id="slot" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as typeof timeSlot)}>
                {Object.entries(TIME_SLOT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="note">備考（任意）</label><textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </section>

        <section className="card">
          <h2>お支払い方法</h2>
          {PAYMENT_CHOICES.map((c) => {
            const reason = unavailableReason(c.id, quote);
            return (
              <label key={c.id} className={`radio-card${reason ? " disabled" : ""}`}>
                <input type="radio" name="payment" disabled={Boolean(reason)} checked={payment === c.id} onChange={() => setPayment(c.id)} />
                <span>
                  {c.label}
                  <div className="muted">{reason ?? c.note}</div>
                </span>
              </label>
            );
          })}
        </section>
      </div>

      <div>
        <OrderSummary quote={quote} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-block" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? "処理中…" : payment === "stripe" ? "お支払い情報の入力へ" : "注文を確定する"}
        </button>
        <p className="muted">
          <a href="/legal/tokushoho" target="_blank">特定商取引法に基づく表記</a>をご確認のうえお進みください。
        </p>
      </div>
    </form>
  );
}

function StripePaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const returnUrl = `${window.location.origin}/checkout/complete?order=${encodeURIComponent(orderId)}`;
    // カードはその場で確定、コンビニ・銀行振込は案内表示後に return_url へ遷移する
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
    if (error) {
      setError(error.message ?? "決済に失敗しました");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={pay}>
      <PaymentElement options={{ layout: "accordion" }} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-block" style={{ marginTop: 16 }} disabled={!stripe || submitting}>
        {submitting ? "処理中…" : "支払う"}
      </button>
    </form>
  );
}
