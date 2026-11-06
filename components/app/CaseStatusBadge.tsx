export default function CaseStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'recovered'
      ? 'bg-app-ok/15 text-app-ok'
      : status === 'stopped'
        ? 'bg-app-danger/10 text-app-danger'
        : 'bg-app-muted text-app-ink-soft';

  return (
    <span
      className={`inline-flex px-[10px] py-[4px] rounded-full text-[12px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
