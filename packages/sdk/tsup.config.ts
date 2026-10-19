import { defineConfig } from "tsup";

/**
 * `src/blocks/shared-catalog.ts` reads the repo's `shared/` folder by relative path, so tsup bundles
 * those files into `dist/index.js` and `dist/index.d.ts` with no extra entry. Two things make that work:
 * `tsconfig.json` sets `rootDir` to the repo root and maps `@shared/*` (type-only imports inside
 * shared files). `scripts/check-dist.mjs` runs after this build and fails if React or a `shared/`
 * path ever reaches the published files.
 */
export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	platform: "neutral",
	target: "es2022",
	clean: true,
	outDir: "dist",
	sourcemap: true,
	dts: true,
	splitting: false,
});
