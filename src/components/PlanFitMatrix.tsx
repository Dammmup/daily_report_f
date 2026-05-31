import type { InternProfile } from "../api";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function contains(text: string, words: string[]) {
  const value = text.toLowerCase();
  return words.some((word) => value.includes(word));
}

export function PlanFitMatrix({ profile }: { profile: InternProfile }) {
  const analysis = profile.survey?.analysis;
  const text = [
    analysis?.skillsSummary,
    analysis?.experienceSummary,
    analysis?.goalAlignment,
    analysis?.suggestedTrack,
    ...(analysis?.strengths || []),
    ...(analysis?.weaknesses || [])
  ]
    .filter(Boolean)
    .join(" ");

  const average = profile.stats.averageScore || 0;
  const items = [
    {
      label: "Архитектура",
      value: clamp((contains(text, ["архитект", "систем", "проектир", "требован"]) ? 55 : 25) + average * 0.35)
    },
    {
      label: "Логика",
      value: clamp((contains(text, ["логик", "алгоритм", "backend", "node", "typescript"]) ? 58 : 30) + average * 0.35)
    },
    {
      label: "Аналитика",
      value: clamp((contains(text, ["аналит", "sql", "данн", "метрик"]) ? 60 : 28) + average * 0.35)
    },
    {
      label: "Самостоятельность",
      value: clamp((contains(text, ["ответствен", "инициатив", "самостоят"]) ? 62 : 35) + average * 0.3)
    },
    {
      label: "Риск дедлайна",
      value: clamp(100 - profile.stats.blockerReports * 18 - (average ? 100 - average : 35))
    }
  ];

  return (
    <div className="fitMatrix">
      {items.map((item) => (
        <div className="criteriaItem" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}%</strong>
          </div>
          <div className="bar">
            <i style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
