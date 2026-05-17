'use client';

import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = () => { timer.current = setTimeout(() => setVisible(true), 300); };
    const hide = () => { clearTimeout(timer.current ?? undefined); setVisible(false); };

    useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

    const posClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
        left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
        right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
    };

    return (
        <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
            {children}
            {visible && (
                <div className={cn('absolute z-50 px-2 py-1 text-2xs font-medium bg-surface-4 text-text-primary border border-border rounded-md whitespace-nowrap pointer-events-none', posClasses[position])}>
                    {content}
                </div>
            )}
        </div>
    );
}