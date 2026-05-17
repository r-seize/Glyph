'use client';

import { useState } from 'react';
import { CodeReference } from '@/types';
import { useCreateCodeRef, useDeleteCodeRef, useUpdateCodeRef } from '@/hooks/useCodeRefs';
import { Plus, X, Pencil, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { refColorAt } from '@/lib/refColors';

interface CodeReferencesPanelProps {
    projectId: string;
    filePath: string;
    commitSha: string;
    references: CodeReference[];
    selection: number[] | null;
    onSelectionClear: () => void;
    onSelectionSet: (lines: number[]) => void;
    onRefHover: (refId: string | null) => void;
    onRefClick: (ref: CodeReference) => void;
}

function formatLines(lines: number[]): string {
    if (lines.length === 0) return '';
    // Group consecutive lines into ranges for compact display
    const ranges: string[] = [];
    let start = lines[0];
    let end = lines[0];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === end + 1) {
            end = lines[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}–${end}`);
            start = end = lines[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
    return `L${ranges.join(', ')}`;
}

function refLines(ref: CodeReference): number[] {
    if (ref.lines && ref.lines.length > 0) return ref.lines;
    return Array.from({ length: ref.line_end - ref.line_start + 1 }, (_, i) => ref.line_start + i);
}

export default function CodeReferencesPanel({
    projectId,
    filePath,
    commitSha,
    references,
    selection,
    onSelectionClear,
    onSelectionSet,
    onRefHover,
    onRefClick,
}: CodeReferencesPanelProps) {
    const create = useCreateCodeRef(projectId, filePath, commitSha);
    const update = useUpdateCodeRef(projectId, filePath, commitSha);
    const del = useDeleteCodeRef(projectId, filePath, commitSha);

    const [newLabel, setNewLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!selection || selection.length === 0) return;
        // Empty label is fine -- the backend falls back to `L<start>` / `L<start>-L<end>`.
        await create.mutateAsync({
            lines: selection,
            label: newLabel.trim() || null,
        });
        setNewLabel('');
        onSelectionClear();
    };

    const startEdit = (ref: CodeReference) => {
        setEditingId(ref.id);
        setEditLabel(ref.label || '');
        // Load ref's current lines into the selection so user can modify them
        onSelectionSet(refLines(ref));
    };

    const commitEdit = async (ref: CodeReference) => {
        const labelChanged = editLabel !== (ref.label || '');
        const currentLines = selection && selection.length > 0 ? selection : refLines(ref);
        const linesChanged = JSON.stringify(currentLines) !== JSON.stringify(refLines(ref));

        if (labelChanged || linesChanged) {
            await update.mutateAsync({
                refId: ref.id,
                data: {
                    label: editLabel.trim() || null,
                    lines: currentLines,
                },
            });
        }
        setEditingId(null);
        setEditLabel('');
        onSelectionClear();
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditLabel('');
        onSelectionClear();
    };

    // When editing a ref's lines, the selection belongs to that ref - don't show the "new ref" bar
    const isEditingLines = editingId !== null;

    return (
        <div className="border-b border-border bg-surface-1 flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Code references ({references.length})
                </span>
                {selection && selection.length > 0 && !isEditingLines && (
                    <span className="text-xs text-text-muted font-mono">{formatLines(selection)}</span>
                )}
            </div>

            {/* New ref bar - only when there's a selection and not editing an existing ref */}
            {selection && selection.length > 0 && !isEditingLines && (
                <div className="px-3 pb-2.5">
                    <div className="flex items-center gap-2 bg-surface border border-border-strong rounded-lg p-2">
                        <span className="text-xs text-text-secondary font-mono whitespace-nowrap flex-shrink-0">
                            {formatLines(selection)}
                        </span>
                        <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') onSelectionClear();
                            }}
                            placeholder="Label (optional)"
                            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                            autoFocus
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleCreate}
                            isLoading={create.isPending}
                        >
                            <Plus size={12} /> Add
                        </Button>
                        <button
                            onClick={onSelectionClear}
                            className="p-1 text-text-muted hover:text-text-secondary"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* Edit-lines hint bar */}
            {isEditingLines && (
                <div className="px-3 pb-2.5">
                    <div className="flex items-center gap-2 bg-surface border border-primary/30 rounded-lg p-2">
                        <span className="text-xs text-text-muted flex-shrink-0">Lines:</span>
                        <span className="text-xs font-mono text-text-secondary flex-shrink-0">
                            {selection && selection.length > 0 ? formatLines(selection) : '-'}
                        </span>
                        <span className="flex-1 text-2xs text-text-muted text-right">Click line numbers to add / remove</span>
                    </div>
                </div>
            )}

            {references.length === 0 && !selection && (
                <p className="px-4 pb-3 text-xs text-text-muted">
                    Click a line number to start a selection.
                </p>
            )}

            {references.length > 0 && (
                <ul className="px-2 pb-2 space-y-0.5">
                    {references.map((ref, index) => {
                        const color = refColorAt(index, ref.color).border;
                        const isConfirming = deleteConfirmId === ref.id;
                        const isEditing = editingId === ref.id;
                        const lines = refLines(ref);

                        return (
                            <li
                                key={ref.id}
                                draggable={!isEditing && !isConfirming}
                                onDragStart={(e) => {
                                    // Don't start drag from action buttons
                                    if ((e.target as HTMLElement).closest('[data-no-drag]')) {
                                        e.preventDefault();
                                        return;
                                    }
                                    const label = ref.label || '';
                                    if (!label) { e.preventDefault(); return; }
                                    e.dataTransfer.setData('text/plain', `{{${label}}}`);
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onMouseEnter={() => onRefHover(ref.id)}
                                onMouseLeave={() => onRefHover(null)}
                                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2 cursor-pointer"
                                onClick={() => !isConfirming && !isEditing && onRefClick(ref)}
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="text-2xs font-mono text-text-muted whitespace-nowrap flex-shrink-0">
                                    {formatLines(lines)}
                                </span>

                                {isEditing ? (
                                    <input
                                        autoFocus
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.stopPropagation(); commitEdit(ref); }
                                            if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); }
                                        }}
                                        className="flex-1 min-w-0 bg-surface border border-primary/40 rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none"
                                    />
                                ) : (
                                    <span className="flex-1 truncate text-xs text-text-secondary">
                                        {ref.label || <span className="italic text-text-muted">No label</span>}
                                    </span>
                                )}

                                {isConfirming ? (
                                    <div className="flex items-center gap-2 flex-shrink-0" data-no-drag onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => { del.mutate(ref.id); setDeleteConfirmId(null); }}
                                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                                        >
                                            Delete
                                        </button>
                                        <span className="text-text-muted text-xs">·</span>
                                        <button
                                            onClick={() => setDeleteConfirmId(null)}
                                            className="text-xs text-text-muted hover:text-text-secondary"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : isEditing ? (
                                    <div className="flex items-center gap-0.5 flex-shrink-0" data-no-drag onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => commitEdit(ref)}
                                            className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                            title="Save"
                                        >
                                            <Check size={12} />
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1 text-text-muted hover:text-text-secondary"
                                            title="Cancel"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" data-no-drag>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEdit(ref); }}
                                            className="p-1 text-text-muted hover:text-text-secondary"
                                            title="Edit"
                                        >
                                            <Pencil size={11} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ref.id); }}
                                            className="p-1 text-text-muted hover:text-red-600"
                                            title="Delete"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
