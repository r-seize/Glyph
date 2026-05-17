import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'secondary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const base =
            'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-black/20 dark:focus-visible:ring-white/20';

        const variants = {
            primary: 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98]',
            secondary: 'bg-surface-2 text-text-primary border border-border hover:bg-surface-3 active:scale-[0.98]',
            ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-2 active:scale-[0.98]',
            danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-[0.98] dark:bg-red-950 dark:text-red-300 dark:border-red-900/50 dark:hover:bg-red-900/60',
        };

        const sizes = {
            sm: 'h-8 px-3 text-sm rounded-md',
            md: 'h-9 px-4 text-sm rounded-lg',
            lg: 'h-11 px-5 text-base rounded-lg',
            icon: 'h-9 w-9 rounded-lg',
        };

        return (
            <button
                ref={ref}
                className={cn(base, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : children}
            </button>
        );
    }
);

Button.displayName = 'Button';
export default Button;
