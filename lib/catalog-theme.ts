import type { CSSProperties } from "react";

// Cor da marca aplicada ao catálogo. Compartilhado entre o catálogo público e o editor do lojista.
export function normalizeThemeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#111513";
}

export function mixHexColor(color: string, target: "#000000" | "#ffffff", amount: number) {
  const source = normalizeThemeColor(color).slice(1);
  const targetHex = target.slice(1);
  const channel = (offset: number) => Math.round(
    Number.parseInt(source.slice(offset, offset + 2), 16) * (1 - amount)
      + Number.parseInt(targetHex.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

export function themeContrast(color: string) {
  const hex = normalizeThemeColor(color).slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160 ? "#111513" : "#ffffff";
}

export function catalogThemeStyle(color: string): CSSProperties {
  const primary = normalizeThemeColor(color);
  return {
    "--primary": primary,
    "--primary-dark": mixHexColor(primary, "#000000", 0.24),
    "--primary-soft": mixHexColor(primary, "#ffffff", 0.88),
    "--primary-contrast": themeContrast(primary),
  } as CSSProperties;
}
