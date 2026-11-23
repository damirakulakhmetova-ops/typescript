// Матрёшка Promise: от самого внутреннего слоя к внешнему.
// Запуск: npx tsx src/promise-matryoshka.ts   (интернет не нужен)

// Слой 0. Колбэк: «вызови эту функцию потом»
function cookCallback(dish: string, done: (result: string) => void) {
  setTimeout(() => done(`${dish} готов`), 300);
}

// Слой 1. new Promise оборачивает колбэк
// Промис — это «чек из кафе»: блюда ещё нет, но есть обещание.
// Состояния: pending (ждём) -> fulfilled (resolve) или rejected (reject)
function cook(dish: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (dish === "") reject(new Error("Пустой заказ"));
    else cookCallback(dish, resolve);
  });
}

// Слой 2. Готовые промисы без ожидания
const ready = Promise.resolve("чай");                   // сразу fulfilled
const failed = Promise.reject(new Error("нет хлеба")); // сразу rejected
failed.catch(() => {}); // чтобы Node не ругался на необработанную ошибку

async function main() {
  // Слой 3. Цепочка .then: каждый then возвращает НОВЫЙ промис
  await cook("плов")
    .then((r) => {
      console.log("1. then:", r);
      return cook("салат"); // вернули промис -> следующий then ждёт его (матрёшка раскрывается)
    })
    .then((r) => console.log("2. then:", r))
    .catch((e: Error) => console.log("catch:", e.message))
    .finally(() => console.log("3. finally: выполняется всегда"));

  // Слой 4. async/await — тот же then, только читается сверху вниз
  try {
    const a = await cook("лагман");
    console.log("4. await:", a);
    await cook(""); // reject -> прыгаем в catch
  } catch (e) {
    console.log("4. try/catch поймал:", (e as Error).message);
  }

  console.log("5. Promise.resolve:", await ready);

  // Слой 5. Комбинаторы — много промисов сразу
  console.log("6. all:", await Promise.all([cook("суп"), cook("хлеб")]));

  const settled = await Promise.allSettled([cook("манты"), failed]);
  console.log("7. allSettled:", settled.map((s) => s.status));

  const slow = new Promise<string>((r) => setTimeout(() => r("медленный"), 500));
  const fast = new Promise<string>((r) => setTimeout(() => r("быстрый"), 100));
  console.log("8. race:", await Promise.race([slow, fast]));

  console.log("9. any:", await Promise.any([failed, cook("компот")]));

  // Бонус: порядок выполнения (event loop)
  console.log("\n--- Порядок: синхронно -> микрозадачи (промисы) -> таймеры ---");
  setTimeout(() => console.log("C. setTimeout (макрозадача)"), 0);
  Promise.resolve().then(() => console.log("B. then (микрозадача)"));
  console.log("A. обычный console.log");
}

main();
