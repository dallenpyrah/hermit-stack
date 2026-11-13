import { defineVars } from "@stylexjs/stylex";

// The light theme is the default value of every variable; theme.view.ts overrides them for dark. The names follow
// Shadcn's, so a component written against Shadcn's tokens reads the same here.
export const colors = defineVars({
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  background: "oklch(1 0 0)",
  border: "oklch(0.922 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  destructiveForeground: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  // Darker than Shadcn's 0.922 so a field's edge reaches 3:1 against the page (WCAG 1.4.11).
  input: "oklch(0.65 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  overlay: "oklch(0 0 0 / 50%)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  // Darker than Shadcn's 0.708 because the ring is drawn solid, not at half opacity, and must reach 3:1.
  ring: "oklch(0.556 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
});

// Shadcn derives sm, md and xl from one --radius; StyleX cannot type a variable that reads its own group, so each
// Step is written out from the same 0.625rem base.
export const radius = defineVars({
  full: "9999px",
  lg: "0.625rem",
  md: "calc(0.625rem - 2px)",
  sm: "calc(0.625rem - 4px)",
  xl: "calc(0.625rem + 4px)",
});

export const space = defineVars({
  lg: "0.75rem",
  md: "0.5rem",
  none: "0",
  sm: "0.375rem",
  xl: "1rem",
  xs: "0.25rem",
  xxl: "1.5rem",
  xxs: "0.125rem",
  xxxl: "2rem",
});

export const control = defineVars({
  lg: "2.5rem",
  md: "2.25rem",
  sm: "2rem",
});

export const font = defineVars({
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
});

export const fontSize = defineVars({
  base: "1rem",
  lg: "1.125rem",
  sm: "0.875rem",
  xl: "1.25rem",
  xs: "0.75rem",
  xxl: "1.5rem",
});

// Each line height pairs with the font size of the same name.
export const lineHeight = defineVars({
  base: "1.5rem",
  lg: "1.75rem",
  none: "1",
  sm: "1.25rem",
  xl: "1.75rem",
  xs: "1rem",
  xxl: "2rem",
});

export const fontWeight = defineVars({
  medium: "500",
  normal: "400",
  semibold: "600",
});

export const shadow = defineVars({
  lg: "0 10px 15px -3px oklch(0 0 0 / 10%), 0 4px 6px -4px oklch(0 0 0 / 10%)",
  sm: "0 1px 3px 0 oklch(0 0 0 / 10%), 0 1px 2px -1px oklch(0 0 0 / 10%)",
  xs: "0 1px 2px 0 oklch(0 0 0 / 5%)",
});

export const motion = defineVars({
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  fast: "150ms",
});
