import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";
import { tailwindThemeExtend } from "./shared/tailwind-theme";

type ThemeColors = { [name: string]: string | ThemeColors };
type ColorWithOpacity = (options: { opacityValue?: string | number }) => string;
type BuildColors = { [name: string]: string | ColorWithOpacity | BuildColors };

/**
 * Theme colours are whole CSS values in variables (`var(--primary)` holds a hex or `hsl()`), which
 * Tailwind 3 can't split, so `bg-primary/90` or `ring-ring/50` used to produce no CSS at all. A colour
 * given as a function gets the opacity: an explicit one (`/90`) mixes the colour with transparent;
 * Tailwind's own opacity variable (plain `bg-primary`) keeps the plain value, so those rules don't change.
 * Only the build gets functions; `shared/tailwind-theme.ts` stays plain strings for the colour pickers.
 */
function allowOpacity(colors: ThemeColors): BuildColors {
	return Object.fromEntries(
		Object.entries(colors).map(([name, value]) => {
			if (typeof value !== "string") return [name, allowOpacity(value)];
			// `hsl(var(--x))` values: Tailwind already adds opacity to those itself.
			if (!value.startsWith("var(")) return [name, value];
			const withOpacity: ColorWithOpacity = ({ opacityValue }) => {
				const opacity = opacityValue === undefined ? "" : String(opacityValue);
				if (opacity === "" || opacity.startsWith("var(")) return value;
				return `color-mix(in srgb, ${value} calc(${opacity} * 100%), transparent)`;
			};
			return [name, withOpacity];
		}),
	);
}

export default {
	darkMode: ["class"],
	content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: { ...tailwindThemeExtend, colors: allowOpacity(tailwindThemeExtend.colors) },
	},
	plugins: [tailwindcssAnimate, typography],
} satisfies Config;
