export function Header({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ReactNode }) {
  return (
    <header className="pageHeader">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="headerIcon">{icon}</div>
    </header>
  );
}
