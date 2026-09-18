export function Placeholder({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-24 text-center">
      <p className="text-[17px] font-semibold tracking-[-0.02em]">{title}</p>
      <p className="max-w-[260px] text-[13px] leading-[1.6] text-ink-3">{note}</p>
    </div>
  );
}
