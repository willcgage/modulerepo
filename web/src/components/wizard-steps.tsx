const STEP_LABELS = ["Basics", "Endplates", "Tracks", "Industries", "Images"];

export function WizardSteps({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center justify-between">
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const state =
          step === current ? "current" : step < current ? "done" : "upcoming";

        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  state === "current"
                    ? "bg-blue-600 text-white"
                    : state === "done"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {step}
              </span>
              <span
                className={`text-xs font-medium ${
                  state === "upcoming" ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {label}
              </span>
            </div>
            {step < STEP_LABELS.length && (
              <div
                className={`mx-2 h-px flex-1 ${
                  state === "done" ? "bg-blue-200" : "bg-gray-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
