import type { Category } from "./api";

export const categoryOptions: { value: Category; label: string }[] = [
  { value: "data-analytics", label: "Дата-аналитика" },
  { value: "system-analytics", label: "Системная аналитика" },
  { value: "machine-learning", label: "Машинное обучение" },
  { value: "marketing", label: "Маркетинг" },
  { value: "sales", label: "Продажи" },
  { value: "erp-development", label: "Разработка ERP" },
  { value: "data-security", label: "Безопасность данных" }
];
