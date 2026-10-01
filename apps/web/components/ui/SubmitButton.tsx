'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  label,
  pendingLabel = 'Salvando...',
  variant = 'primary',
  size,
  confirmMessage,
}: {
  label: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm';
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={`btn-${variant} ${size === 'sm' ? 'btn-sm' : ''}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
