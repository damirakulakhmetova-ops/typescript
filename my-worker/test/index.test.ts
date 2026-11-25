import { SELF } from "cloudflare:test";
import { expect, it } from "vite-plus/test";

it("главная страница подсказывает адрес и разрешает CORS", async () => {
	const response = await SELF.fetch("https://example.com/");
	expect(response.status).toBe(200);
	expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	const body = (await response.json()) as { message: string };
	expect(body.message).toContain("/weather");
});
