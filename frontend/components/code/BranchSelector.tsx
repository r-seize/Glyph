'use client';

import { useRef, useEffect, useState } from 'react';
import { GitBranch, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchSelectorProps {
    branches: string[];
    selected: string;
    onSelect: (branch: string) => void;
    className?: string;
}

export default function BranchSelector({ branches, selected, onSelect, className }: BranchSelectorProps) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                !btnRef.current?.contains(e.target as Node) &&
                !menuRef.current?.contains(e.target as Node)
            ) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div className={cn('relative', className)}>
            <button
                ref={btnRef}
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 h-8 px-2.5 bg-surface-1 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            >
                <GitBranch size={13} className="text-text-muted flex-shrink-0" />
                <span className="font-mono text-xs">{selected}</span>
                <ChevronDown size={12} className={cn('text-text-muted transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div
                        ref={menuRef}
                        className="absolute top-full left-0 mt-1 min-w-[160px] bg-surface border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1"
                    >
                        {branches.map((b) => (
                            <button
                                key={b}
                                onClick={() => { onSelect(b); setOpen(false); }}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-1 transition-colors',
                                    b === selected && 'text-primary'
                                )}
                            >
                                <GitBranch size={12} className="text-text-muted flex-shrink-0" />
                                <span className="flex-1 text-xs font-mono truncate">{b}</span>
                                {b === selected && <Check size={11} className="text-primary flex-shrink-0" />}
                            </button>
                        ))}
                        {branches.length === 0 && (
                            <p className="px-3 py-2 text-xs text-text-muted">No branch</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
