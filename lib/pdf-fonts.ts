import { Font } from "@react-pdf/renderer";

let fontsRegistered = false;

export async function registerPdfFonts() {
  if (fontsRegistered) return;

  Font.register({
    family: "Mangal",
    fonts: [
      {
        src: "/fonts/Mangal.ttf",
        fontWeight: 400,
      },
      {
        src: "/fonts/MangalB.ttf",
        fontWeight: 700,
      },
    ],
  });

  fontsRegistered = true;
}

export function getPdfFontFamily(language: "en" | "mr" = "en") {
  return ("Helvetica");
}
