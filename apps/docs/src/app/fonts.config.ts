import localFont from "next/font/local";

export const inter = localFont({
  adjustFontFallback: false,
  declarations: [{ prop: "font-family", value: "Inter" }],
  display: "optional",
  src: "../../assets/fonts/Inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

export const geistMono = localFont({
  adjustFontFallback: false,
  declarations: [{ prop: "font-family", value: "Geist Mono" }],
  display: "optional",
  src: "../../assets/fonts/GeistMono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});
