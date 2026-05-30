import { Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, type User } from "../api";
import { Header } from "../components/Header";
import type { Session } from "../session";

const traits = ["аналитичность", "коммуникабельность", "самостоятельность", "ответственность", "креативность", "стрессоустойчивость"];

export function Onboarding({ session, onDone }: { session: Session; onDone: (user: User) => void }) {
  const [selectedTraits, setSelectedTraits] = useState<string[]>(["ответственность"]);
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [learningStyle, setLearningStyle] = useState("Мне удобнее получать короткие задачи и быстрый фидбек.");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleTrait(trait: string) {
    setSelectedTraits((current) =>
      current.includes(trait) ? current.filter((item) => item !== trait) : [...current, trait]
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api("/api/survey", {
        method: "POST",
        body: JSON.stringify({ traits: selectedTraits, skills, experience, learningStyle, goal })
      });
      const me = await api<{ user: User }>("/api/me");
      onDone(me.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завершить опрос");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flow">
      <Header eyebrow="Первый вход" title="Короткий опрос стажера" icon={<Sparkles />} />
      <form className="panel form wide" onSubmit={submit}>
        <div className="traitGrid">
          {traits.map((trait) => (
            <button
              className={selectedTraits.includes(trait) ? "chip active" : "chip"}
              key={trait}
              type="button"
              onClick={() => toggleTrait(trait)}
            >
              {trait}
            </button>
          ))}
        </div>
        <label>
          Профессиональные навыки
          <textarea value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, SQL, продажи, аналитика..." />
        </label>
        <label>
          Опыт
          <input value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="Например: 3 месяца учебных проектов" />
        </label>
        <label>
          Стиль обучения
          <textarea value={learningStyle} onChange={(event) => setLearningStyle(event.target.value)} />
        </label>
        <label>
          Цель стажировки
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Чему хотите научиться и какой проект закрыть" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primaryButton" disabled={saving}>
          <Sparkles size={18} />
          {saving ? "Сохраняем..." : "Завершить опрос"}
        </button>
      </form>
    </section>
  );
}
