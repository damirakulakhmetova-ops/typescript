import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// Токен бота (BOT_TOKEN) здесь НЕ указываем: он хранится секретом
// в dash.cloudflare.com → Workers & Pages → my-bot → Settings → Variables and Secrets.
export default defineConfig({
	worker: {
		name: "my-bot",
		compatibilityDate: "2026-11-19",
		entrypoint,
	},
});
