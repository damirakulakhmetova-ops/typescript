// Бот из ДЗ 9, переселённый в Cloudflare Worker.
//
// Раньше: бот жил на ноутбуке (bot.start() = long polling — сам каждую секунду спрашивал Telegram
// «есть новые сообщения?»). Закрыли ноутбук — бот замолчал.
// Теперь: Telegram сам присылает каждое сообщение POST-запросом на адрес Worker (webhook).
//
// Адреса Worker:
//   POST /webhook — сюда Telegram присылает сообщения
//   GET  /setup   — один раз «прописать» webhook в Telegram
//   GET  /        — проверка, что Worker жив
//
// Токен НЕ в коде: это секрет BOT_TOKEN в настройках Worker на dash.cloudflare.com.

import { Bot, InlineKeyboard, Keyboard, webhookCallback } from "grammy";

interface Env {
	BOT_TOKEN?: string;
}

// =====================================================================
// 1. Кирпичики: свои промисы
// =====================================================================

// new Promise + resolve: «подожди ms миллисекунд»
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// new Promise + reject + Promise.race: если promise не успел за ms, ошибка
function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
	const timer = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error(`${name}: не ответил за ${ms} мс`)), ms),
	);
	return Promise.race([promise, timer]);
}

// Цепочка .then: fetch -> проверка -> JSON
function getJSON<T>(url: string, name: string): Promise<T> {
	const request = fetch(url).then((res) => {
		if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
		return res.json() as Promise<T>;
	});
	return withTimeout(request, 5000, name);
}

// =====================================================================
// 2. Данные из API
// =====================================================================

interface OpenMeteo {
	current: { temperature_2m: number; wind_speed_10m: number; weather_code: number };
}

interface Weather {
	temp: number;
	wind: number;
	emoji: string;
}

function weatherEmoji(code: number): string {
	if (code === 0) return "☀️";
	if (code <= 3) return "⛅";
	if (code <= 48) return "🌫";
	if (code <= 67) return "🌧";
	if (code <= 77) return "❄️";
	if (code <= 82) return "🌦";
	return "⛈";
}

async function getWeather(lat = 43.24, lon = 76.89): Promise<Weather> {
	const url =
		`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
		`&current=temperature_2m,wind_speed_10m,weather_code`;
	const data = await getJSON<OpenMeteo>(url, "Погода");
	return {
		temp: data.current.temperature_2m,
		wind: data.current.wind_speed_10m,
		emoji: weatherEmoji(data.current.weather_code),
	};
}

// Курсы: сколько стоит 1 USD в KZT, EUR, RUB
interface UsdRates {
	KZT: number;
	EUR: number;
	RUB: number;
	source: string;
}

interface ErApi {
	rates: Record<string, number>;
}
interface FawazApi {
	usd: Record<string, number>;
}

function ratesFromErApi(): Promise<UsdRates> {
	return getJSON<ErApi>("https://open.er-api.com/v6/latest/USD", "er-api").then((d) => ({
		KZT: d.rates.KZT,
		EUR: d.rates.EUR,
		RUB: d.rates.RUB,
		source: "open.er-api.com",
	}));
}

function ratesFromJsDelivr(): Promise<UsdRates> {
	const url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
	return getJSON<FawazApi>(url, "jsdelivr").then((d) => ({
		KZT: d.usd.kzt,
		EUR: d.usd.eur,
		RUB: d.usd.rub,
		source: "currency-api (jsdelivr)",
	}));
}

// Кэш: если курс брали меньше 10 минут назад, не ходим в интернет.
// В Worker кэш живёт, пока жив «экземпляр» Worker, — иногда он сбрасывается, это нормально.
let cache: { rates: UsdRates; at: number } | null = null;

function getRates(): Promise<UsdRates> {
	if (cache && Date.now() - cache.at < 10 * 60 * 1000) {
		return Promise.resolve(cache.rates);
	}
	// Promise.any: берём первого, кто ответил УСПЕШНО; ошибка, только если упали оба
	return Promise.any([ratesFromErApi(), ratesFromJsDelivr()]).then((rates) => {
		cache = { rates, at: Date.now() };
		return rates;
	});
}

type Currency = "USD" | "EUR" | "RUB";

async function priceInKzt(cur: string): Promise<number> {
	if (cur !== "USD" && cur !== "EUR" && cur !== "RUB") {
		return Promise.reject(new Error(`Не знаю валюту ${cur}`));
	}
	const r = await getRates();
	if (cur === "USD") return r.KZT;
	return r.KZT / r[cur as Exclude<Currency, "USD">];
}

interface DogApi {
	message: string;
}
function getDogPhoto(): Promise<string> {
	return getJSON<DogApi>("https://dog.ceo/api/breeds/image/random", "Собаки").then((d) => d.message);
}

function getBrokenSource(): Promise<string> {
	return Promise.reject(new Error("этот источник сломан специально, для демонстрации"));
}

function flipCoin(): Promise<string> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			if (Math.random() > 0.5) resolve("Орёл — сегодня твой день! 🍀");
			else reject(new Error("Решка — попробуй ещё раз 🙃"));
		}, 1500);
	});
}

// =====================================================================
// 3. Клавиатуры
// =====================================================================

const mainMenu = new Keyboard()
	.text("🌤 Погода").text("💱 Курс").row()
	.text("📊 Сводка").text("🐶 Собака").row()
	.text("🏁 Гонка улиток").text("🍀 Монетка").row()
	.text("🎲 Кубик").requestLocation("📍 Погода там, где я")
	.resized();

function currencyButtons(): InlineKeyboard {
	return new InlineKeyboard()
		.text("🇺🇸 USD", "rate:USD")
		.text("🇪🇺 EUR", "rate:EUR")
		.text("🇷🇺 RUB", "rate:RUB")
		.row()
		.text("❓ BTC (ошибка)", "rate:BTC");
}

// =====================================================================
// 4. Бот и обработчики
// =====================================================================
// Важно для Worker: каждый обработчик должен ДОЖДАТЬСЯ (await) всех своих ответов.
// Когда обработчик закончился, Worker отвечает Telegram «принято» и может сразу
// «уснуть» — недожданные промисы просто оборвутся.

function createBot(token: string): Bot {
	const bot = new Bot(token);

	bot.command("start", async (ctx) => {
		await ctx.reply(
			"Привет! Я бот-демонстрация промисов 🪆 Теперь живу в Cloudflare ☁️\n" +
				"Жми кнопки внизу, пиши слова вроде «погода» или «курс», " +
				"или отправь мне геолокацию.",
			{ reply_markup: mainMenu },
		);
	});

	// --- Погода + курс одновременно: Promise.all ---
	bot.hears(/погод/i, async (ctx) => {
		await ctx.replyWithChatAction("typing");
		const [w, usd] = await Promise.all([getWeather(), priceInKzt("USD")]);
		await ctx.reply(
			`${w.emoji} В Алматы ${w.temp} °C, ветер ${w.wind} км/ч\n` +
				`💵 Заодно курс: 1 USD = ${usd.toFixed(2)} ₸`,
		);
	});

	// --- Курс + инлайн-кнопки ---
	bot.hears(/курс|валют|доллар|тенге/i, async (ctx) => {
		const rates = await getRates();
		await ctx.reply(
			`💱 1 USD = ${rates.KZT.toFixed(2)} ₸\nИсточник (кто ответил первым): ${rates.source}\n\nВыбери валюту:`,
			{ reply_markup: currencyButtons() },
		);
	});

	bot.callbackQuery(/^rate:(\w+)$/, async (ctx) => {
		const cur = ctx.match[1];
		try {
			const price = await priceInKzt(cur);
			await ctx.editMessageText(`💱 1 ${cur} = ${price.toFixed(2)} ₸`, {
				reply_markup: currencyButtons(),
			});
			await ctx.answerCallbackQuery();
		} catch (err) {
			await ctx.answerCallbackQuery({ text: `❌ ${(err as Error).message}`, show_alert: true });
		}
	});

	// --- Сводка: Promise.allSettled ---
	bot.hears(/сводк/i, async (ctx) => {
		const msg = await ctx.reply("⏳ Опрашиваю 4 источника одновременно…");

		const results = await Promise.allSettled([
			getWeather(),
			getRates(),
			getDogPhoto(),
			getBrokenSource(),
		]);
		const names = ["Погода", "Курсы", "Собаки", "Сломанный API"];

		const lines = results.map((r, i) =>
			r.status === "fulfilled"
				? `✅ ${names[i]}: ответил`
				: `❌ ${names[i]}: ${(r.reason as Error).message}`,
		);
		const ok = results.filter((r) => r.status === "fulfilled").length;

		await ctx.api.editMessageText(
			ctx.chat.id,
			msg.message_id,
			`📊 Сводка (${ok} из ${results.length} ответили)\n\n${lines.join("\n")}`,
		);
	});

	// --- Собака ---
	bot.hears(/собак|пёс|пес|dog/i, async (ctx) => {
		await ctx.replyWithChatAction("upload_photo");
		const url = await getDogPhoto();
		await ctx.replyWithPhoto(url, { caption: "🐶 Случайная собака из dog.ceo" });
	});

	// --- Гонка улиток: Promise.race + Promise.all ---
	bot.hears(/гонк/i, async (ctx) => {
		const snails = ["🐌 Тимур", "🐌 Айгерим", "🐌 Бекзат"];
		const msg = await ctx.reply(`🏁 Старт!\n${snails.join("\n")}`);

		const runs = snails.map((name) => {
			const time = 1000 + Math.random() * 3000;
			return sleep(time).then(() => ({ name, time }));
		});

		const winner = await Promise.race(runs);
		await ctx.api.editMessageText(
			ctx.chat.id,
			msg.message_id,
			`🏆 Победила ${winner.name} за ${(winner.time / 1000).toFixed(1)} с!\nЖдём остальных…`,
		);

		const all = await Promise.all(runs);
		const table = all
			.sort((a, b) => a.time - b.time)
			.map((r, i) => `${i + 1}. ${r.name} — ${(r.time / 1000).toFixed(1)} с`)
			.join("\n");
		await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `🏁 Финиш!\n\n${table}`);
	});

	// --- Монетка удачи: new Promise с resolve/reject + then/catch/finally ---
	// В версии для ноутбука цепочку не ждали. В Worker её нужно вернуть (return),
	// иначе Worker «уснёт» раньше, чем монетка упадёт.
	bot.hears(/монет|удач/i, async (ctx) => {
		await ctx.reply("🪙 Подбрасываю…");
		return flipCoin()
			.then((text) => ctx.reply(`✅ ${text}`))
			.catch((err: Error) => ctx.reply(`❌ ${err.message}`))
			.finally(() => ctx.reply("Монетка упала. Ещё раз? Напиши «монетка»"));
	});

	// --- Кубик ---
	bot.hears(/кубик|🎲/i, async (ctx) => {
		const dice = await ctx.replyWithDice("🎲");
		await sleep(4000);
		const value = dice.dice.value;
		await ctx.reply(value === 6 ? "🎉 Шестёрка! Джекпот!" : `Выпало ${value}`);
	});

	// --- Геолокация ---
	bot.on("message:location", async (ctx) => {
		const { latitude, longitude } = ctx.message.location;
		const w = await getWeather(latitude, longitude);
		await ctx.reply(`📍 У тебя сейчас ${w.emoji} ${w.temp} °C, ветер ${w.wind} км/ч`);
	});

	// --- Всё остальное ---
	bot.on("message:text", (ctx) =>
		ctx.reply("Не поняла 🤔 Попробуй: погода, курс, сводка, собака, гонка, монетка, кубик", {
			reply_markup: mainMenu,
		}),
	);

	bot.catch(async (err) => {
		console.error("Ошибка:", err.error);
		await err.ctx.reply("😵 Что-то пошло не так, попробуй ещё раз").catch(() => {});
	});

	return bot;
}

// =====================================================================
// 5. Worker: принимает запросы от Telegram
// =====================================================================

// Секрет для заголовка X-Telegram-Bot-Api-Secret-Token: по нему Worker понимает,
// что запрос пришёл именно от Telegram, а не от кого-то, кто узнал адрес.
// Получаем его из токена (SHA-256), чтобы не заводить второй секрет.
async function webhookSecret(token: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Бот создаётся один раз на «экземпляр» Worker и потом переиспользуется
let handler: ((req: Request) => Promise<Response>) | null = null;
let bot: Bot | null = null;

function text(body: string, status = 200): Response {
	return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export default {
	async fetch(request, env) {
		const token = env.BOT_TOKEN;
		if (!token) {
			return text(
				"Нет секрета BOT_TOKEN. Добавьте его: dash.cloudflare.com → Workers & Pages → my-bot → " +
					"Settings → Variables and Secrets → Add → Type: Secret.",
				500,
			);
		}

		if (!bot || !handler) {
			bot = createBot(token);
			handler = webhookCallback(bot, "cloudflare-mod", {
				secretToken: await webhookSecret(token),
			});
		}

		const url = new URL(request.url);

		// Сюда Telegram присылает сообщения
		if (url.pathname === "/webhook" && request.method === "POST") {
			return handler(request);
		}

		// Один раз: сообщить Telegram адрес, куда слать сообщения
		if (url.pathname === "/setup") {
			const webhookUrl = `${url.origin}/webhook`;
			await bot.api.setWebhook(webhookUrl, {
				secret_token: await webhookSecret(token),
				drop_pending_updates: true,
			});
			const me = await bot.api.getMe();
			return text(`✅ Webhook подключён: ${webhookUrl}\nБот @${me.username} теперь живёт в Cloudflare.`);
		}

		return text("🤖 my-bot работает. Сообщения от Telegram принимаются на /webhook");
	},
} satisfies ExportedHandler<Env>;
