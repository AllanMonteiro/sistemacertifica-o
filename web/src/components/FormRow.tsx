import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function FormRow({ label, children }: Props) {
  return (
    <label className="form-row">
      <span>{label}</span>
      {children}
    </label>
  );
}
