'use client';

import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Optional extra classes applied to the inner <input>. */
  inputClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { inputClassName = '', className = '', ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input
        {...rest}
        ref={ref}
        type={show ? 'text' : 'password'}
        className={`pr-9 ${inputClassName}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
});
