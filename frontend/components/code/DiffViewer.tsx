'use client';

import { cn } from '@/lib/utils';

interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    lineNumber?: number;
}

interface DiffViewerProps {
    diff: string;
    className?: string;
}

function parseDiff(diff: string): DiffLine[] {
    const lines: DiffLine[] = [];
    for (const line of diff.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            lines.push({ type: 'add', content: line.slice(1) });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            lines.push({ type: 'remove', content: line.slice(1) });
        } else if (!line.startsWith('@@') && !line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
            lines.push({ type: 'context', content: line.slice(1) });
        }
    }
    return lines;
}

export default function DiffViewer({ diff, className }: DiffViewerProps) {
    const lines = parseDiff(diff);

    return (
        <div className={cn('overflow-auto font-mono text-xs leading-relaxed', className)}>
            <table className="w-full border-collapse">
                <tbody>
                    {lines.map((line, i) => (
                        <tr
                            key={i}
                            className={cn(
                                line.type === 'add' && 'bg-emerald-950/40',
                                line.type === 'remove' && 'bg-red-950/40',
                            )}
                        >
                            <td className={cn(
                                'select-none w-4 px-2 text-2xs border-r',
                                line.type === 'add' && 'text-emerald-400 border-emerald-900/40',
                                line.type === 'remove' && 'text-red-400 border-red-900/40',
                                line.type === 'context' && 'text-text-muted border-border',
                            )}>
                                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                            </td>
                            <td className={cn(
                                'pl-3 pr-4 py-0.5 whitespace-pre',
                                line.type === 'add' && 'text-emerald-300',
                                line.type === 'remove' && 'text-red-300',
                                line.type === 'context' && 'text-text-secondary',
                            )}>
                                {line.content || ' '}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}