// ДЗ: получить погоду и курс валют ОДНОВРЕМЕННО

// --- Как выглядят ответы API (форма JSON) ---

interface Weather {
  current: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
  };
}

interface Rates {
  result: string;                 // "success" или "error"
  base_code: string;              // базовая валюта, у нас "USD"
  time_last_update_utc: string;   // когда курс обновлялся
  rates: Record<string, number>;  // { "KZT": 520.5, "EUR": 0.92, ... }
}

// --- Запросы ---

async function getWeather(): Promise<Weather> {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=43.24&longitude=76.89&current=temperature_2m,wind_speed_10m";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Погода: ошибка ${response.status}`);
  return response.json();
}

async function getRates(): Promise<Rates> {
  const url = "https://open.er-api.com/v6/latest/USD";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Курсы: ошибка ${response.status}`);
  return response.json();
}

// --- Главная функция ---

async function main() {
  // Оба запроса отправляются сразу, ждём, пока придут оба ответа
  const [weather, rates] = await Promise.all([getWeather(), getRates()]);

  const kzt = rates.rates.KZT;
  const eur = rates.rates.EUR;
  const rub = rates.rates.RUB;

  console.log(`В Алматы сейчас ${weather.current.temperature_2m} °C`);
  console.log(`Ветер ${weather.current.wind_speed_10m} км/ч`);
  console.log(`1 USD = ${kzt.toFixed(2)} KZT`);
  console.log(`1 EUR = ${(kzt / eur).toFixed(2)} KZT`);
  console.log(`1 RUB = ${(kzt / rub).toFixed(2)} KZT`);
}

main().catch((err) => console.error("Не получилось:", err.message));
