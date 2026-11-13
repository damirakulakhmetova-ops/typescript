// Модель заявок Academic Nomad: путь ученика от первого обращения до оплаты курса

// Этапы воронки, по которым движется заявка
type LeadStatus =
  | "new" // только что оставил заявку
  | "consultation" // назначена или проведена консультация
  | "invoiced" // отправлен счёт на оплату
  | "paid" // курс оплачен
  | "lost"; // отказался или пропал

// Заявка ученика — главная сущность
interface Lead {
  id: number;
  name: string; // имя преподавателя
  phone: string; // контакт для связи (WhatsApp)
  source: string; // откуда пришёл: Instagram, сайт, рекомендация
  status: LeadStatus;
  createdAt: string; // дата заявки в формате ГГГГ-ММ-ДД
}

// Примеры заявок
const leads: Lead[] = [
  { id: 1, name: "Айгерим", phone: "+7 701 123 45 67", source: "Instagram", status: "paid", createdAt: "2026-11-02" },
  { id: 2, name: "Данияр", phone: "+7 777 234 56 78", source: "сайт", status: "consultation", createdAt: "2026-11-08" },
  { id: 3, name: "Мадина", phone: "+7 705 345 67 89", source: "рекомендация", status: "new", createdAt: "2026-11-12" },
];

// Конверсия в оплату: какой процент заявок дошёл до оплаты курса
function getConversionRate(list: Lead[]): number {
  // Пустой список — конверсия 0%, чтобы не делить на ноль
  if (list.length === 0) {
    return 0;
  }
  const paidCount = list.filter((lead) => lead.status === "paid").length;
  return Math.round((paidCount / list.length) * 100);
}

console.log("Конверсия в оплату, %:", getConversionRate(leads)); // 33
