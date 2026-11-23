// ДЗ: Telegram-бот, который получает данные через ВСЕ варианты Promise
//
//  new Promise(...)        -> sleep(), монетка удачи, таймаут
//  .then / .catch / .finally -> getJSON(), монетка удачи
//  async / await           -> почти все обработчики
//  Promise.resolve(...)    -> кэш курсов
//  Promise.reject(...)     -> «сломанный источник», неизвестная валюта
//  Promise.all(...)        -> погода + курс одновременно, гонка: ждём всех
//  Promise.allSettled(...) -> «Сводка»: показываем, кто ответил, а кто нет
//  Promise.race(...)       -> таймаут запросов, «Гонка улиток»
//  Promise.any(...)        -> курс из двух зеркал: кто первый ответил без ошибки

import { Bot, InlineKeyboard, Keyboard } from "grammy";

process.loadEnvFile(); // читает BOT_TOKEN из файла .env
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("Нет BOT_TOKEN в файле .env");

const bot = new Bot(token);

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
    return res.json() as Promise<T>; // промис внутри then «распаковывается» сам
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

// Кэш: если курс брали меньше 10 минут назад, не ходим в интернет
let cache: { rates: UsdRates; at: number } | null = null;

function getRates(): Promise<UsdRates> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) {
    return Promise.resolve(cache.rates); // уже готовое значение, завёрнутое в промис
  }
  // Promise.any: берём первого, кто ответил УСПЕШНО; ошибка, только если упали оба
  return Promise.any([ratesFromErApi(), ratesFromJsDelivr()]).then((rates) => {
    cache = { rates, at: Date.now() };
    return rates;
  });
}

type Currency = "USD" | "EUR" | "RUB";

// Сколько тенге стоит 1 единица валюты
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

// Специально сломанный источник, чтобы в «Сводке» было видно rejected
function getBrokenSource(): Promise<string> {
  return Promise.reject(new Error("этот источник сломан специально, для демонстрации"));
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
// 4. Обработчики
// =====================================================================

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я бот-демонстрация промисов 🪆\n" +
      "Жми кнопки внизу, пиши слова вроде «погода» или «курс», " +
      "или отправь мне геолокацию.",
    { reply_markup: mainMenu },
  );
});

// --- Погода + курс одновременно: Promise.all ---
bot.hears(/погод/i, async (ctx) => {
  await ctx.replyWithChatAction("typing"); // «печатает…» вверху чата
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
    // показываем всплывающее окно с ошибкой
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

  // каждая улитка — промис, который выполнится через случайное время
  const runs = snails.map((name) => {
    const time = 1000 + Math.random() * 3000;
    return sleep(time).then(() => ({ name, time }));
  });

  const winner = await Promise.race(runs); // кто ПЕРВЫЙ
  await ctx.api.editMessageText(
    ctx.chat.id,
    msg.message_id,
    `🏆 Победила ${winner.name} за ${(winner.time / 1000).toFixed(1)} с!\nЖдём остальных…`,
  );

  const all = await Promise.all(runs); // ждём ВСЕХ
  const table = all
    .sort((a, b) => a.time - b.time)
    .map((r, i) => `${i + 1}. ${r.name} — ${(r.time / 1000).toFixed(1)} с`)
    .join("\n");
  await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `🏁 Финиш!\n\n${table}`);
});

// --- Монетка удачи: new Promise с resolve/reject + then/catch/finally ---
function flipCoin(): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.5) resolve("Орёл — сегодня твой день! 🍀");
      else reject(new Error("Решка — попробуй ещё раз 🙃"));
    }, 1500);
  });
}

bot.hears(/монет|удач/i, (ctx) => {
  ctx.reply("🪙 Подбрасываю…");
  flipCoin()
    .then((text) => ctx.reply(`✅ ${text}`))
    .catch((err: Error) => ctx.reply(`❌ ${err.message}`))
    .finally(() => ctx.reply("Монетка упала. Ещё раз? Напиши «монетка»"));
});

// --- Кубик: анимированный dice от Telegram ---
bot.hears(/кубик|🎲/i, async (ctx) => {
  const dice = await ctx.replyWithDice("🎲"); // Telegram сам выбирает число
  await sleep(4000); // ждём, пока закончится анимация
  const value = dice.dice.value;
  await ctx.reply(value === 6 ? "🎉 Шестёрка! Джекпот!" : `Выпало ${value}`);
});

// --- Геолокация: погода по координатам ---
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

// Если в обработчике вылетела ошибка (reject без catch), бот не падает
bot.catch(async (err) => {
  console.error("Ошибка:", err.error);
  await err.ctx.reply("😵 Что-то пошло не так, попробуй ещё раз").catch(() => {});
});

bot.start({ onStart: (me) => console.log(`Бот @${me.username} запущен`) });
