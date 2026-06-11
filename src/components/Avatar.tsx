// Аватар пользователя: фото (если есть avatarUrl, напр. подтянутое из Telegram),
// иначе цветной кружок с первой буквой имени.
export function Avatar({
  name,
  avatarColor,
  avatarUrl,
  small = false
}: {
  name: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  small?: boolean;
}) {
  const className = small ? "avatar small" : "avatar";
  if (avatarUrl) return <img className={className} src={avatarUrl} alt={name} />;
  return (
    <span className={className} style={{ background: avatarColor }}>
      {name.slice(0, 1)}
    </span>
  );
}
