import type { ActionRecommendationRow } from "@/lib/types/database";

export function RecommendationList(props: {
  items: ActionRecommendationRow[];
}) {
  const { items } = props;
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">추천 액션이 없습니다.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li
          key={r.id}
          className="rounded border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{r.title}</span>
            <span className="text-xs text-zinc-500">
              {r.action_type} · {r.priority} · {r.status}
            </span>
          </div>
          {r.description ? (
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              {r.description}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
