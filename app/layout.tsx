import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "솔루션 생성기",
  description: "문제 해결 단위 솔루션 초안 자동 생성",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
