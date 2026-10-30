import { useState } from 'react';

import {
  formatJalaliDraft,
  isoToJalaliInput,
  jalaliInputToIso,
} from '../lib/locale';

interface PersianDateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  'aria-label'?: string;
}

export function PersianDateInput({
  value,
  onChange,
  min,
  max,
  className,
  'aria-label': ariaLabel = 'تاریخ شمسی',
}: PersianDateInputProps) {
  const [inputState, setInputState] = useState(() => ({
    sourceValue: value,
    draft: isoToJalaliInput(value),
  }));
  const [invalid, setInvalid] = useState(false);
  const draft =
    inputState.sourceValue === value
      ? inputState.draft
      : isoToJalaliInput(value);

  return (
    <input
      aria-label={ariaLabel}
      aria-invalid={invalid}
      className={className}
      dir="ltr"
      inputMode="numeric"
      placeholder="۱۴۰۵/۰۱/۰۱"
      value={draft}
      onChange={(event) => {
        const nextDraft = formatJalaliDraft(event.target.value);
        setInputState({ sourceValue: value, draft: nextDraft });
        if (!nextDraft) {
          setInvalid(false);
          onChange('');
          return;
        }
        const iso = jalaliInputToIso(nextDraft);
        if (!iso || (min && iso < min) || (max && iso > max)) {
          setInvalid(nextDraft.length === 10);
          return;
        }
        setInvalid(false);
        onChange(iso);
      }}
    />
  );
}
