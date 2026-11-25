// Worker «Погода и курс»: GET /weather?city=Алматы → JSON с погодой И курсом валют.
// Оба запроса идут одновременно через Promise.all (как в ДЗ 8).
// Погода — Open-Meteo, курс — open.er-api.com (ключи не нужны).

interface GeoResult {
	results?: {
		name: string;
		country: string;
		latitude: number;
		longitude: number;
	}[];
}

interface Forecast {
	current: {
		time: string;
		temperature_2m: number;
		apparent_temperature: number;
		relative_humidity_2m: number;
		wind_speed_10m: number;
		weather_code: number;
	};
}

interface Rates {
	result: string;
	time_last_update_utc: string;
	rates: Record<string, number>; // сколько единиц валюты стоит 1 USD
}

// Разрешаем запросы со страницы из любого места (в т.ч. открытой как файл)
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
	});
}

// --- Погода ---

async function getWeather(city: string) {
	// 1. Находим координаты города
	const geoUrl =
		"https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=" +
		encodeURIComponent(city);
	const geoRes = await fetch(geoUrl);
	if (!geoRes.ok) throw new Error(`Геокодер: ошибка ${geoRes.status}`);
	const geo: GeoResult = await geoRes.json();
	const place = geo.results?.[0];
	if (!place) return null;

	// 2. Запрашиваем текущую погоду по координатам
	const forecastUrl =
		`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
		"&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
		"&wind_speed_unit=ms&timezone=auto";
	const fRes = await fetch(forecastUrl);
	if (!fRes.ok) throw new Error(`Погода: ошибка ${fRes.status}`);
	const forecast: Forecast = await fRes.json();

	return {
		city: place.name,
		country: place.country,
		time: forecast.current.time,
		temperature: forecast.current.temperature_2m,
		feelsLike: forecast.current.apparent_temperature,
		humidity: forecast.current.relative_humidity_2m,
		wind: forecast.current.wind_speed_10m,
		code: forecast.current.weather_code,
	};
}

// --- Курс валют: сколько тенге стоит 1 USD, 1 EUR, 1 RUB ---

async function getRates() {
	const res = await fetch("https://open.er-api.com/v6/latest/USD");
	if (!res.ok) throw new Error(`Курсы: ошибка ${res.status}`);
	const data: Rates = await res.json();
	if (data.result !== "success") throw new Error("Курсы: сервис вернул ошибку");

	const kzt = data.rates.KZT;
	return {
		USD: kzt,
		EUR: kzt / data.rates.EUR,
		RUB: kzt / data.rates.RUB,
		updated: data.time_last_update_utc,
	};
}

export default {
	async fetch(request) {
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

		const url = new URL(request.url);

		if (url.pathname === "/weather") {
			const city = url.searchParams.get("city")?.trim() || "Алматы";
			try {
				// Оба запроса отправляются сразу, ждём, пока придут оба ответа
				const [weather, rates] = await Promise.all([getWeather(city), getRates()]);
				if (!weather) return json({ error: `Город «${city}» не найден` }, 404);
				return json({ weather, rates });
			} catch (err) {
				return json({ error: (err as Error).message }, 502);
			}
		}

		return json({ message: "Погода и курс валют. Используйте /weather?city=Алматы" });
	},
} satisfies ExportedHandler;
