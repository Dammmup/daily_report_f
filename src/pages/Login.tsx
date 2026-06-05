import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, setToken } from "../api";
import type { Session } from "../session";

function getRegistrationMeta() {
  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer || "",
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || ""
  };
}

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<Session>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });
      setToken(result.token);
      onLogin(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    }
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email && !phone) {
      setError("Необходимо заполнить email или номер телефона");
      return;
    }

    try {
      const result = await api<{ ok: boolean; delivered: boolean; devCode?: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          password,
          name,
          registrationMeta: getRegistrationMeta()
        })
      });
      setDevCode(result.devCode || "");
      setMessage(result.delivered ? "Код подтверждения отправлен на почту." : "Код показан ниже для проверки.");
      setMode("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код подтверждения");
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<Session>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          code
        })
      });
      setToken(result.token);
      onLogin(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить код");
    }
  }

  return (
    <main className="loginPage">
      <section className="loginPanel">
        <div className="brandMark large">DR</div>
        <h1>DailyReport ERP</h1>
        <p>Платформа для дэйликов, посещаемости, AI-сводок, MongoDB и Telegram-бота.</p>

        {mode !== "verify" && (
          <div className="tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Вход
            </button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              Регистрация
            </button>
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={submitLogin} className="form">
            <label>
              Email или номер телефона
              <input type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@company.kz или +77071234567" required />
            </label>
            <label>
              Пароль
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" required />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primaryButton">
              <CheckCircle2 size={18} />
              Войти
            </button>
          </form>
        )}

        {mode === "register" && (
          <form className="form" onSubmit={requestCode}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.kz" />
            </label>
            <label>
              Номер телефона
              <input type="text" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+77071234567" />
            </label>
            <label>
              Имя
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя Фамилия" required />
            </label>
            <label>
              Пароль
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Придумайте пароль" required />
            </label>
            <p className="mutedText">Все новые пользователи регистрируются как стажеры. Тимлидов назначает администратор.</p>
            {error && <div className="error">{error}</div>}
            <button className="secondaryButton">
              <Mail size={18} />
              Зарегистрироваться и получить код
            </button>
          </form>
        )}

        {mode === "verify" && (
          <div className="form">
            <button className="backButton" type="button" onClick={() => setMode("register")}>
              <ArrowLeft size={16} />
              Назад к регистрации
            </button>
            <form className="form" onSubmit={verify}>
              <label>
                Код подтверждения для {email || phone}
                <input type="text" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" required />
              </label>
              {message && <div className="notice">{message}</div>}
              {devCode && <div className="codeBox">Код подтверждения: {devCode}</div>}
              {error && <div className="error">{error}</div>}
              <button className="primaryButton">
                <CheckCircle2 size={18} />
                Подтвердить и войти
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
