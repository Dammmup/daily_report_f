import { Building2, CheckCircle2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, type Category, type User } from "../api";
import { Header } from "../components/Header";
import { categoryOptions } from "../constants";

export function DepartmentSelect({ user, onDone }: { user: User; onDone: (user: User) => void }) {
  const [category, setCategory] = useState<Category>("erp-development");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await api<{ user: User }>("/api/department", {
        method: "POST",
        body: JSON.stringify({ category })
      });
      onDone(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выбрать департамент");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flow">
      <Header
        eyebrow={user.role === "lead" ? "Тимлид" : "Стажер"}
        title="Выберите департамент"
        icon={<Building2 />}
      />
      <form className="panel form wide" onSubmit={submit}>
        <p>
          Департамент выбирается один раз. Тимлид сможет создавать и утверждать проектный план только для своего
          департамента, а стажер будет писать дэйлики по плану выбранного департамента.
        </p>
        <label>
          Департамент
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primaryButton" disabled={saving}>
          <CheckCircle2 size={18} />
          {saving ? "Сохраняем..." : "Подтвердить департамент"}
        </button>
      </form>
    </section>
  );
}
