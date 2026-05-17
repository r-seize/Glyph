'use client';

import { useState } from 'react';
import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
    src?: string | null;
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

const sizes = { xs: 'h-7 w-7 text-2xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-base' };
const pxSizes = { xs: 28, sm: 32, md: 40, lg: 64 };

function hashColor(name: string): string {
    const colors = [
        '#374375', '#7c3aed', '#0369a1', '#0f766e', '#15803d',
        '#b45309', '#c2410c', '#be123c', '#6d28d9', '#0e7490',
        '#4338ca', '#047857', '#b91c1c', '#1d4ed8', '#7e22ce',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name, size = 'md', className }: AvatarProps) {
    const [imgError, setImgError] = useState(false);
    const px = pxSizes[size];
    const color = hashColor(name);

    if (src && !imgError) {
        return (
            <div className={cn('rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/10 dark:ring-white/10', sizes[size], className)}>
                <img
                    src={src}
                    alt={name}
                    width={px}
                    height={px}
                    className="object-cover w-full h-full"
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    return (
        <div
            className={cn('rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-white select-none', sizes[size], className)}
            style={{ backgroundColor: color }}
        >
            {getInitials(name)}
        </div>
    );
}
