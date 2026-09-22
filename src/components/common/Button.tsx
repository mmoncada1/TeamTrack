import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-300',
  secondary:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[44px]',
  lg: 'px-5 py-3 text-base min-h-[48px]',
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
