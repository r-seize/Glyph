'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResizableHandleProps {
    onResize: (deltaPx: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    className?: string;
    direction?: 'horizontal' | 'vertical';
}

export default function ResizableHandle({
    onResize,
    onResizeStart,
    onResizeEnd,
    className,
    direction = 'horizontal',
}: ResizableHandleProps) {
    const [dragging, setDragging] = useState(false);
    const lastPos = useRef(0);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
            setDragging(true);
            onResizeStart?.();
        },
        [direction, onResizeStart]
    );

    useEffect(() => {
        if (!dragging) return;

        const handleMove = (e: MouseEvent) => {
            const current = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = current - lastPos.current;
            if (delta !== 0) {
                lastPos.current = current;
                onResize(delta);
            }
        };

        const handleUp = () => {
            setDragging(false);
            onResizeEnd?.();
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);

        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevSelect;
        };
    }, [dragging, direction, onResize, onResizeEnd]);

    return (
        <div
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
            className={cn(
                'group relative flex-shrink-0 z-10',
                direction === 'horizontal'
                    ? 'w-1 h-full cursor-col-resize'
                    : 'h-1 w-full cursor-row-resize',
                className
            )}
        >
            <div
                className={cn(
                    'absolute inset-0 bg-border transition-colors',
                    dragging ? 'bg-border-accent' : 'group-hover:bg-border-strong'
                )}
            />
        </div>
    );
}
