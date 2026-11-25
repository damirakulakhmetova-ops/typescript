import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "my-worker",
		compatibilityDate: "2026-11-19",
		entrypoint,
	},
});
