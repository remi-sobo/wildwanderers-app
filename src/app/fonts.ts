import localFont from "next/font/local";

// Self-hosted variable fonts. Fraunces carries display and numerals, Jakarta
// carries every functional string. See docs/DESIGN.md section 2.
export const fraunces = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    {
      path: "./fonts/fraunces-normal.woff2",
      weight: "300 900",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-italic.woff2",
      weight: "300 900",
      style: "italic",
    },
  ],
});

export const jakarta = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    {
      path: "./fonts/jakarta-normal.woff2",
      weight: "300 800",
      style: "normal",
    },
  ],
});
