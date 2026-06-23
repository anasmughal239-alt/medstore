import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedStore — Medical Store Manager",
  description: "Inventory management for medical stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
