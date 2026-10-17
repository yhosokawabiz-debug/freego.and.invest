import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/CartLink";
import "./globals.css";

export const metadata: Metadata = {
  title: "FREEGO お米のオンラインショップ",
  description: "産地直送・ご注文後精米の新米をお届けします。定期便なら 5% オフ・送料無料。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="logo">FREEGO お米のオンラインショップ</Link>
            <CartLink />
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <Link href="/legal/tokushoho">特定商取引法に基づく表記</Link>
          <div>© ハンズフリートラベル株式会社</div>
        </footer>
      </body>
    </html>
  );
}
