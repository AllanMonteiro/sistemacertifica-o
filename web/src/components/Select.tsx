import React from 'react';

type Option = {
  value: string | number;
  label: string;
};

type Props = {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
};

export default function Select({ label, value, onChange, options, disabled }: Props) {
  return (
    <label className="form-row">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
