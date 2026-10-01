import type { InputHTMLAttributes, ReactNode } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: ReactNode;
  className?: string;
};

export function Field({ label, name, hint, className, id, ...inputProps }: FieldProps) {
  const inputId = id ?? name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
        {inputProps.required && <span className="text-red-500"> *</span>}
      </label>
      <input id={inputId} name={name} className="input mt-1" {...inputProps} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  className,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
  rows?: number;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        className="input mt-1"
      />
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  className,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  className?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="input mt-1"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
