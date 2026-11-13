"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ComponentType, ReactElement, SVGProps } from "react";

import { themeStorageKey } from "#src/content/script/theme-script.pure.ts";
import { CheckGlyph, SunGlyph, SystemGlyph } from "#src/components/brand/glyphs.view.tsx";

type Choice = "light" | "dark" | "system";

const choices: readonly {
  readonly value: Choice;
  readonly label: string;
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { Icon: SunGlyph, label: "Light", value: "light" },
  { Icon: Moon, label: "Dark", value: "dark" },
  { Icon: SystemGlyph, label: "System", value: "system" },
];

const ContrastIcon = (): ReactElement => (
  <svg
    className="hs-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3.5v17M15 4v16M18 5.5v13" />
  </svg>
);

const stored = (): Choice => {
  const value = globalThis.localStorage.getItem(themeStorageKey);

  if (value === "light" || value === "system") {
    return value;
  }

  return "dark";
};

const apply = (value: Choice): void => {
  const classes = globalThis.document.documentElement.classList;

  classes.remove("light", "dark", "system");
  classes.add(value);
  globalThis.localStorage.setItem(themeStorageKey, value);
};

export const AppearanceMenu = (): ReactElement => {
  const [choice, setChoice] = useState<Choice>("dark");

  useEffect((): void => {
    setChoice(stored());
  }, []);

  const choose = (value: string): void => {
    if (value !== "light" && value !== "dark" && value !== "system") {
      return;
    }

    apply(value);
    setChoice(value);
  };

  return (
    <div className="hs-appearance">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="hs-row">
            <ContrastIcon />
            <span className="hs-row-label">Appearance</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="hs-menu"
          aria-label="Appearance"
          side="top"
          align="start"
          sideOffset={4}
          avoidCollisions={false}
          loop
        >
          <DropdownMenuRadioGroup className="hs-menu-group" value={choice} onValueChange={choose}>
            {choices.map(({ value, label, Icon }): ReactElement => (
              <DropdownMenuRadioItem key={value} value={value} className="hs-menu-row">
                <Icon className="hs-menu-icon" aria-hidden="true" />
                {label}
                <DropdownMenuItemIndicator asChild>
                  <CheckGlyph className="hs-menu-check" aria-hidden="true" />
                </DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
