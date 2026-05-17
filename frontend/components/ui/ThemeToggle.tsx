'use client';

import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
    variant?: 'icon' | 'menu';
    className?: string;
}

export default function ThemeToggle({ variant = 'menu', className }: ThemeToggleProps) {
    const { theme, resolvedTheme, setTheme, toggle } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (variant === 'icon') {
        return (
            <button
                onClick={toggle}
                aria-label={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                className={cn(
                    'p-1.5 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface-1 transition-colors',
                    className
                )}
            >
                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
        );
    }

    const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
    const label = theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light';

    return (
        <div ref={ref} className={cn('relative', className)}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-surface-2 w-full transition-colors"
            >
                <Icon size={15} />
                <span>Theme: {label}</span>
            </button>

            {open && (
                <div className="absolute bottom-full left-0 mb-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-40">
                    {[
                        { value: 'light' as const, icon: Sun, label: 'Light' },
                        { value: 'dark' as const, icon: Moon, label: 'Dark' },
                        { value: 'system' as const, icon: Monitor, label: 'System' },
                    ].map(({ value, icon: ItemIcon, label: itemLabel }) => (
                        <button
                            key={value}
                            onClick={() => {
                                setTheme(value);
                                setOpen(false);
                            }}
                            className={cn(
                                'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface-1 transition-colors',
                                theme === value ? 'text-text-primary font-medium' : 'text-text-secondary'
                            )}
                        >
                            <ItemIcon size={14} />
                            {itemLabel}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
