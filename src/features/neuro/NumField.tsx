import { FIELD_INPUT } from '../data/fieldStyles';
import { parseAmount } from '../assist/calcMath';

/** Labelled number input. Accepts "12,5" and scientific notation such as 1e13. */
export function NumField({
  label,
  value,
  onChange,
  unit,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  id: string;
}) {
  const bad = value.trim() !== '' && parseAmount(value) === undefined;
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-base font-medium">
      {label}
      <span className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          className={`${FIELD_INPUT} ${bad ? 'border-red-600' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={bad}
        />
        {unit && <span className="whitespace-nowrap text-text-muted">{unit}</span>}
      </span>
      {bad && <span className="text-sm text-red-700 dark:text-red-300">Enter a number</span>}
    </label>
  );
}

/** Reads a field, returning undefined when blank or not a number. */
export function readNum(value: string): number | undefined {
  return parseAmount(value);
}
