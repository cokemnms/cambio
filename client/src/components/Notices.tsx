import type { Notice } from "../useGame";

export function Notices({ notices }: { notices: Notice[] }) {
  return (
    <div className="notices">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice-${n.kind}`}>
          {n.message}
        </div>
      ))}
    </div>
  );
}
