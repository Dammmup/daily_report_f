import type { Category } from "./api";

export const categoryOptions: { value: Category; label: string }[] = [
  { value: "data-system-ml", label: "Дата + системная аналитика + ML" },
  { value: "marketing-sales", label: "Маркетинг + продажи" },
  { value: "erp-development", label: "Разработка ERP" },
  { value: "data-security", label: "Безопасность данных" }
];
