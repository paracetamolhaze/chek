import localFont from "next/font/local";

// Dot-matrix display face — what a thermal printer would print.
export const doto = localFont({
  src: "../../../brand/fonts/Doto-Variable.woff2",
  variable: "--font-doto",
  weight: "100 900",
  display: "swap",
  preload: true,
});

// Text face. Variable weight + width.
export const martian = localFont({
  src: "../../../brand/fonts/MartianMono-Variable.woff2",
  variable: "--font-martian",
  weight: "100 800",
  style: "normal",
  display: "swap",
  preload: true,
  declarations: [{ prop: "font-stretch", value: "75% 112.5%" }],
});
