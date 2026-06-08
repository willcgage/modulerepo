export function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  required = true,
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="mb-4 block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

export function NumberField({
  label,
  name,
  defaultValue,
  required = true,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: number | string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
}) {
  return (
    <label className="mb-4 block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type="number"
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        step={step}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  required = false,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="mb-4 block text-sm font-medium text-gray-700">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        required={required}
        rows={rows}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  required = true,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="mb-4 block text-sm font-medium text-gray-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  onChange,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary:
      "border border-gray-300 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      type="submit"
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${styles[variant]}`}
    >
      {label}
    </button>
  );
}
