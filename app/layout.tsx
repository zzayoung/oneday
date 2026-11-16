import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneDay · 任务与笔记",
  description: "私人的任务与笔记空间。安排每一天，留下每一个想法。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
