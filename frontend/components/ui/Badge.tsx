import { cn } from '@/lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'documented' | 'undocumented' | 'owner' | 'admin' | 'developer' | 'viewer' | 'language';
    color?: string;
    className?: string;
}

export default function Badge({ children, variant = 'default', color, className }: BadgeProps) {
    const variants = {
        default: 'bg-surface-3 text-text-secondary border border-border',
        documented: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900/50',
        undocumented: 'bg-surface-3 text-text-muted border border-border',
        owner: 'bg-black/8 text-black border border-black/15 dark:bg-white/10 dark:text-white dark:border-white/20',
        admin: 'bg-surface-3 text-text-primary border border-border-strong',
        developer: 'bg-surface-2 text-text-secondary border border-border',
        viewer: 'bg-surface-2 text-text-muted border border-border',
        language: '',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium',
                variants[variant],
                className
            )}
            style={variant === 'language' && color ? { backgroundColor: `${color}18`, color, borderColor: `${color}35`, border: '1px solid' } : undefined}
        >
            {children}
        </span>
    );
}
