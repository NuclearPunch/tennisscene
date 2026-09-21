export function Placeholder({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-8 py-24 text-center">
      <p className="font-bold">{title}</p>
      <p className="max-w-[260px] text-ink-3">{note}</p>
    </div>
  );
}
