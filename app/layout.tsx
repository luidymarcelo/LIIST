import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://liist.com.br"),
  title: "LIIST Commerce",
  description: "Catálogos, pedidos por WhatsApp e comandas internas para comércio local.",
  openGraph: {
    title: "LIIST Commerce",
    description: "Catálogos, pedidos por WhatsApp e comandas internas para comércio local.",
    images: [{ url: "/og.png", width: 1728, height: 907, alt: "LIIST Commerce" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LIIST Commerce",
    description: "Catálogos, pedidos por WhatsApp e comandas internas para comércio local.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
