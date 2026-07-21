// Avatar giả định dùng chung: có ảnh thật thì dùng, không thì tạo avatar gradient từ tên.
const AV_GRADS: [string, string][] = [
  ["#33A3DC", "#1A4565"], ["#0070FA", "#153a5c"], ["#18E4A2", "#0e9c74"], ["#F0A9F9", "#9d5bb0"], ["#FFC45F", "#e0851f"],
  ["#FC4C02", "#a83302"], ["#33A3DC", "#0070FA"], ["#2f80c2", "#1A4565"], ["#7a6f52", "#463f2e"], ["#3f8f8f", "#215353"],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

export function initialsOf(name: string): string {
  const t = name.trim();
  if (/^[A-Z]{2,4}$/.test(t)) return t;
  const w = t.split(/\s+/).filter(Boolean);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, url, size, className = "" }: { name: string; url?: string | null; size: number; className?: string }) {
  if (url) return <img src={url} alt="" className={`av-img ${className}`} style={{ width: size, height: size }} />;
  const g = AV_GRADS[hashStr(name) % AV_GRADS.length];
  return (
    <span
      className={`av-gen ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: `linear-gradient(135deg, ${g[0]}, ${g[1]})` }}
    >
      {initialsOf(name)}
    </span>
  );
}
