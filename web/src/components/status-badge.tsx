const STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  inactive: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  archived: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.archived;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}
