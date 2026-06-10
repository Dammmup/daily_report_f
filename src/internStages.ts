// Классификация стажёра по осмысленной стадии для канбан-доски.
// Раньше группировка была «mock»-эвристикой (только по числу отчётов и баллу).
// Теперь — единый набор стадий, общий для админки и дашборда лида, чтобы логика не расходилась.

type KanbanIntern = {
  firstLoginCompleted: boolean;
  category?: string;
  reportsCount: number;
  averageScore: number;
  assignedOpenSteps: number;
};

export type InternStageId = "onboarding" | "active" | "idle" | "risk";

/**
 * Каждый стажёр попадает ровно в одну стадию (приоритет сверху вниз):
 *  - onboarding — ещё не завершил вход или не выбрал департамент;
 *  - risk — есть отчёты, но средняя продуктивность < 50% (нужен присмотр);
 *  - idle — в департаменте, но нет активных назначенных шагов;
 *  - active — есть открытые назначенные задачи и нормальные показатели.
 */
export function internStage(intern: KanbanIntern): InternStageId {
  if (!intern.firstLoginCompleted || !intern.category) return "onboarding";
  if (intern.reportsCount > 0 && intern.averageScore < 50) return "risk";
  if (intern.assignedOpenSteps === 0) return "idle";
  return "active";
}

const stageOrder: { id: InternStageId; title: string }[] = [
  { id: "onboarding", title: "Онбординг" },
  { id: "active", title: "В работе" },
  { id: "idle", title: "Без задач" },
  { id: "risk", title: "Зона риска" }
];

export function groupInternsByStage<T extends KanbanIntern>(interns: T[]) {
  return stageOrder.map((stage) => ({
    id: stage.id,
    title: stage.title,
    items: interns.filter((intern) => internStage(intern) === stage.id)
  }));
}
