// Расчёты для Academic Nomad — онлайн-школы подготовки преподавателей к IELTS

// Наценка при оплате в рассрочку — 15%
const INSTALLMENT_MARKUP = 0.15;

// Итоговая цена курса Teaching IELTS.
// basePrice — базовая цена в тенге, isInstallment — оплата в рассрочку или нет.
function getCoursePrice(basePrice: number, isInstallment: boolean): number {
  if (isInstallment) {
    // Округляем до целых тенге, чтобы не было хвостов вроде 206999.99999999997
    return Math.round(basePrice * (1 + INSTALLMENT_MARKUP));
  }
  return basePrice;
}

// Стоимость одной заявки из рекламы: бюджет за месяц делим на количество заявок.
function getCostPerLead(budget: number, leads: number): number {
  // Если заявок нет, делить нельзя — сообщаем об ошибке
  if (leads <= 0) {
    throw new Error("Количество заявок должно быть больше нуля");
  }
  // Округляем до целых тенге, как и цену курса
  return Math.round(budget / leads);
}

// Примеры
const BASE_PRICE = 180_000;

console.log("Цена без рассрочки:", getCoursePrice(BASE_PRICE, false)); // 180000
console.log("Цена в рассрочку:", getCoursePrice(BASE_PRICE, true)); // 207000
console.log("Стоимость одной заявки:", getCostPerLead(150_000, 50)); // 3000
console.log("Стоимость заявки с округлением:", getCostPerLead(100_000, 3)); // 33333
