import type { Metadata, Viewport } from "next";
import { fraunces, jakarta } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wild Wanderers",
  description: "The coaching platform for Wild Wanderers Fitness.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wild Wanderers",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e331f",
  width: "device-width",
  initialScale: 1,
  // Cover lets the chrome extend under the notch and home indicator, and the
  // shell claws the content back with safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
