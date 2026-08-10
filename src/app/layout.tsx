import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "업사이클 키링 디자인",
  description: "청바지 업사이클링 키링을 3D로 설계하고 값을 매겨보는 진로체험 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 태블릿에서 3D를 두 손가락으로 만질 때 페이지 전체가 확대되지 않도록
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0DBDB9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
