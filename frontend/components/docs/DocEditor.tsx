'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { useQuery } from '@tanstack/react-query';
import { codeRefsApi, projectsApi } from '@/lib/api';
import type { CodeReference } from '@/types';
import {
    Bold, Italic, Strikethrough, Code, FileCode, Quote,
    Heading1, Heading2, Heading3,
    List, ListOrdered, ListChecks, Minus,
    Link as LinkIcon, Undo2, Redo2, Braces, Loader2, Check, AtSign,
} from 'lucide-react';
import { useSaveDoc } from '@/hooks/useDoc';
import { cn } from '@/lib/utils';
import { refColorAt } from '@/lib/refColors';

const lowlight = createLowlight(common);


type EditorMode = 'wysiwyg' | 'markdown';

interface DocEditorProps {
    projectId: string;
    filePath: string;
    commitSha: string;
    initialContent?: string;
    onRefClick?: (ref: CodeReference) => void;
}

interface ToolButtonProps {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}

function ToolButton({ onClick, active, disabled, title, children }: ToolButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                'h-7 w-7 flex items-center justify-center rounded-md text-text-secondary transition-colors',
                'hover:bg-surface-2 hover:text-text-primary',
                'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary',
                active && 'bg-surface-2 text-text-primary',
            )}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <span className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />;
}

function Toolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
    if (!editor) return null;
    const d = disabled;
    return (
        <div className={cn('flex items-center gap-0.5 flex-wrap', d && 'opacity-40 pointer-events-none')}>
            <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || d} title="Undo"><Undo2 size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || d} title="Redo"><Redo2 size={14} /></ToolButton>
            <Divider />
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} disabled={d} title="Heading 1"><Heading1 size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} disabled={d} title="Heading 2"><Heading2 size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} disabled={d} title="Heading 3"><Heading3 size={14} /></ToolButton>
            <Divider />
            <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={d} title="Bold"><Bold size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={d} title="Italic"><Italic size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} disabled={d} title="Strikethrough"><Strikethrough size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} disabled={d} title="Inline code"><Code size={14} /></ToolButton>
            <Divider />
            <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={d} title="Bullet list"><List size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={d} title="Numbered list"><ListOrdered size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} disabled={d} title="Task list"><ListChecks size={14} /></ToolButton>
            <Divider />
            <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={d} title="Quote"><Quote size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} disabled={d} title="Code block"><FileCode size={14} /></ToolButton>
            <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={d} title="Divider"><Minus size={14} /></ToolButton>
            <ToolButton
                disabled={d}
                onClick={() => {
                    const previous = editor.getAttributes('link').href as string | undefined;
                    const url = window.prompt('Link URL', previous || 'https://');
                    if (url === null) return;
                    if (url === '') {
                        editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    } else {
                        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    }
                }}
                active={editor.isActive('link')}
                title="Link"
            >
                <LinkIcon size={14} />
            </ToolButton>
        </div>
    );
}

function getMarkdown(editor: Editor): string {
    return (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
}

interface CodeRefSuggestion {
    active: boolean;
    query: string;
    top: number;
    left: number;
    triggerPos: number;
}

interface ContributorSuggestion {
    active: boolean;
    query: string;
    top: number;
    left: number;
    triggerPos: number;
    triggerLen: number;
}

const codeRefPluginKey = new PluginKey('codeRefDecorations');

export default function DocEditor({ projectId, filePath, commitSha, initialContent, onRefClick }: DocEditorProps) {
    const [mode, setMode] = useState<EditorMode>('wysiwyg');
    const [rawMd, setRawMd] = useState(initialContent || '');
    const [editorHasContent, setEditorHasContent] = useState(!!initialContent);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [suggestion, setSuggestion] = useState<CodeRefSuggestion | null>(null);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [contributorSuggestion, setContributorSuggestion] = useState<ContributorSuggestion | null>(null);
    const [contributorIndex, setContributorIndex] = useState(0);
    const saveDoc = useSaveDoc();
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextUpdate = useRef(true);

    // Dirty-tracking refs for Ctrl+S and auto-save on leave
    const dirtyRef = useRef(false);
    const currentContentRef = useRef(initialContent || '');
    // Stable refs so cleanup effect captures latest values without re-running
    const saveMutateRef = useRef(saveDoc.mutate);
    const projectIdRef = useRef(projectId);
    const filePathRef = useRef(filePath);
    const commitShaRef = useRef(commitSha);
    saveMutateRef.current = saveDoc.mutate;
    projectIdRef.current = projectId;
    filePathRef.current = filePath;
    commitShaRef.current = commitSha;

    // Ref to immediate-save function (always up-to-date, used by Ctrl+S)
    const immediateSaveRef = useRef<() => void>(() => {});
    const codeRefStateRef = useRef<{ refs: CodeReference[]; projectId: string; onRefClick?: (ref: CodeReference) => void }>({ refs: [], projectId });
    const suggestionHandlerRef = useRef<(key: string) => boolean>(() => false);

    const { data: allCodeRefs } = useQuery({
        queryKey: ['codeRefsAll', projectId],
        queryFn: async () => (await codeRefsApi.listAll(projectId)).data,
        staleTime: 10_000,
        refetchInterval: 30_000,
    });

    const { data: contributors } = useQuery({
        queryKey: ['contributors', projectId],
        queryFn: async () => (await projectsApi.contributors(projectId)).data,
        staleTime: 120_000,
    });

    const triggerSave = (content: string) => {
        dirtyRef.current = true;
        currentContentRef.current = content;
        setSaveStatus('saving');
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(async () => {
            dirtyRef.current = false;
            try {
                await saveDoc.mutateAsync({ projectId, file_path: filePath, commit_sha: commitSha, content });
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } catch {
                setSaveStatus('idle');
            }
        }, 1500);
    };

    // Keep immediateSaveRef current on every render
    immediateSaveRef.current = () => {
        if (!dirtyRef.current) return;
        if (debounce.current) clearTimeout(debounce.current);
        dirtyRef.current = false;
        setSaveStatus('saving');
        saveDoc.mutateAsync({ projectId, file_path: filePath, commit_sha: commitSha, content: currentContentRef.current })
            .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000); })
            .catch(() => setSaveStatus('idle'));
    };

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                link: { openOnClick: false, autolink: true, HTMLAttributes: { class: 'doc-link' } },
            }),
            Placeholder.configure({ placeholder: 'Start documenting this file...' }),
            Typography,
            TaskList,
            TaskItem.configure({ nested: true }),
            CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
            Markdown.configure({ html: false, linkify: true, breaks: false, transformPastedText: true, transformCopiedText: true }),
        ],
        content: initialContent || '',
        onUpdate({ editor }) {
            setEditorHasContent(!editor.isEmpty);
            if (skipNextUpdate.current) {
                skipNextUpdate.current = false;
                return;
            }
            triggerSave(getMarkdown(editor));

            // Detect {{ trigger for code ref suggestions
            const { from } = editor.state.selection;
            const textBefore = editor.state.doc.textBetween(Math.max(0, from - 60), from, '\n');
            const match = textBefore.match(/\{\{([^}]*)$/);
            // Detect / trigger for contributor mentions (only outside code blocks)
            const slashMatch = !editor.isActive('codeBlock') && !editor.isActive('code')
                ? textBefore.match(/(^|\s)\/([a-zA-Z0-9_.-]*)$/)
                : null;
            if (match) {
                const coords = editor.view.coordsAtPos(from);
                const editorEl = editor.view.dom.closest('.tiptap-editor-wrap') as HTMLElement | null;
                const offsetTop = editorEl ? editorEl.getBoundingClientRect().top : 0;
                setSuggestion({
                    active: true,
                    query: match[1].toLowerCase(),
                    top: coords.bottom - offsetTop + 6,
                    left: coords.left - (editorEl?.getBoundingClientRect().left ?? 0),
                    triggerPos: from - match[0].length,
                });
                setSuggestionIndex(0);
                setContributorSuggestion(null);
            } else if (slashMatch) {
                const coords = editor.view.coordsAtPos(from);
                const editorEl = editor.view.dom.closest('.tiptap-editor-wrap') as HTMLElement | null;
                const offsetTop = editorEl ? editorEl.getBoundingClientRect().top : 0;
                const fullMatch = slashMatch[0]; // e.g. " /john" or "/john"
                setContributorSuggestion({
                    active: true,
                    query: slashMatch[2].toLowerCase(),
                    top: coords.bottom - offsetTop + 6,
                    left: coords.left - (editorEl?.getBoundingClientRect().left ?? 0),
                    triggerPos: from - fullMatch.length + (slashMatch[1] ? 1 : 0), // pos of /
                    triggerLen: fullMatch.length - (slashMatch[1] ? 1 : 0),
                });
                setContributorIndex(0);
                setSuggestion(null);
            } else {
                setSuggestion(null);
                setContributorSuggestion(null);
            }
        },
        editorProps: {
            attributes: {
                class: 'tiptap-doc hljs-glyph prose prose-sm dark:prose-invert max-w-none focus:outline-none px-6 py-5 min-h-full',
                spellcheck: 'false',
            },
            handleKeyDown(view, event) {
                if (suggestionHandlerRef.current(event.key)) return true;

                // Delete entire {{label}} chip on Backspace/Delete adjacent to (or inside) it
                if (event.key === 'Backspace' || event.key === 'Delete') {
                    const { state } = view;
                    const { from, to } = state.selection;
                    if (from !== to) return false;
                    const $pos = state.doc.resolve(from);
                    const text = $pos.parent.textContent;
                    const offset = $pos.parentOffset;
                    const blockStart = $pos.start();
                    const patterns = [...text.matchAll(/\{\{[^}]+\}\}/g)];
                    for (const m of patterns) {
                        const start = m.index!;
                        const end = start + m[0].length;
                        const adjacentBack = event.key === 'Backspace' && offset === end;
                        const adjacentFwd = event.key === 'Delete' && offset === start;
                        const inside = offset > start && offset < end;
                        if (adjacentBack || adjacentFwd || inside) {
                            const tr = state.tr.delete(blockStart + start, blockStart + end);
                            view.dispatch(tr);
                            event.preventDefault();
                            return true;
                        }
                    }
                }
                return false;
            },
        },
    });

    // Load editor content ONCE per (file, commit) pair.
    // Avoids reloading on every save (which would strip trailing spaces and
    // reset the user's chosen mode), while still loading the latest content
    // when navigating to a different file/commit.
    const loadedKeyRef = useRef<string>('');
    useEffect(() => {
        if (!editor) return;
        const key = `${filePath}::${commitSha}`;
        if (loadedKeyRef.current === key) return;
        // Wait for the doc query to resolve before loading (avoid flashing empty content).
        if (initialContent === undefined) return;
        loadedKeyRef.current = key;
        const md = initialContent || '';
        skipNextUpdate.current = true;
        setRawMd(md);
        setEditorHasContent(!!md);
        editor.commands.setContent(md);
    }, [editor, initialContent, filePath, commitSha]);

    // Ctrl+S - intercept browser "Save page" and save doc immediately
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                immediateSaveRef.current();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    // Auto-save on unmount (navigation away, file switch, tab close)
    useEffect(() => {
        return () => {
            if (dirtyRef.current && currentContentRef.current !== undefined) {
                saveMutateRef.current({
                    projectId: projectIdRef.current,
                    file_path: filePathRef.current,
                    commit_sha: commitShaRef.current,
                    content: currentContentRef.current,
                });
            }
        };
    }, []);

    // Register the code-ref decoration plugin once the editor is ready
    useEffect(() => {
        if (!editor) return;
        const stateRef = codeRefStateRef;
        const plugin = new Plugin({
            key: codeRefPluginKey,
            props: {
                decorations(pmState) {
                    const { refs, projectId: pid } = stateRef.current;
                    const decs: Decoration[] = [];
                    pmState.doc.descendants((node, pos) => {
                        if (!node.isText || !node.text) return;
                        const pattern = /\{\{([^}]+)\}\}/g;
                        let m;
                        while ((m = pattern.exec(node.text)) !== null) {
                            const from = pos + m.index;
                            const to = from + m[0].length;
                            const label = m[1];
                            const ref = refs.find((r) => r.label === label);
                            const missing = refs.length > 0 && !ref;
                            const chip = document.createElement('span');
                            chip.className = `code-ref-chip${missing ? ' code-ref-missing' : ''}`;
                            chip.textContent = label;
                            if (missing) {
                                chip.title = 'This reference was deleted or renamed';
                            } else if (ref) {
                                // Color the chip with the same palette index as the code panel:
                                // index = position of this ref among refs of the same file.
                                const fileRefs = refs.filter((r) => r.file_path === ref.file_path);
                                const index = fileRefs.findIndex((r) => r.id === ref.id);
                                const colors = refColorAt(index, ref.color);
                                chip.style.backgroundColor = colors.background;
                                chip.style.borderColor = colors.border;
                                chip.style.color = colors.text;

                                chip.title = `${ref.file_path} · L${ref.line_start}–${ref.line_end} · Ctrl+Click to open file`;
                                const capturedRef = ref;
                                chip.addEventListener('click', (e: MouseEvent) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        const parts = window.location.pathname.split('/');
                                        const wsIdx = parts.indexOf('workspace');
                                        const workspaceId = wsIdx !== -1 ? parts[wsIdx + 1] : '';
                                        window.location.href = `/workspace/${workspaceId}/project/${stateRef.current.projectId}/file/${capturedRef.file_path}`;
                                    } else {
                                        stateRef.current.onRefClick?.(capturedRef);
                                    }
                                });
                            }
                            // Hide the raw {{label}} text, show the chip widget before it
                            decs.push(Decoration.inline(from, to, { style: 'display:none; user-select:none;' }));
                            decs.push(Decoration.widget(from, chip, { side: -1 }));
                        }
                    });
                    return DecorationSet.create(pmState.doc, decs);
                },
            },
        });
        editor.registerPlugin(plugin);
        return () => { editor.unregisterPlugin(codeRefPluginKey); };
    }, [editor]);

    // Keep code refs in sync and re-trigger decoration rendering
    useEffect(() => {
        if (!editor) return;
        codeRefStateRef.current = {
            refs: (allCodeRefs as CodeReference[] | undefined) ?? [],
            projectId,
            onRefClick,
        };
        editor.view.dispatch(editor.state.tr);
    }, [editor, allCodeRefs, projectId, onRefClick]);

    const handleSwitchToMarkdown = () => {
        if (!editor) return;
        const md = getMarkdown(editor);
        setRawMd(md);
        setMode('markdown');
    };

    const handleSwitchToWysiwyg = () => {
        if (!editor) return;
        skipNextUpdate.current = true;
        editor.commands.setContent(rawMd);
        setMode('wysiwyg');
    };

    const handleRawMdChange = (value: string) => {
        setRawMd(value);
        triggerSave(value);
    };

    const filteredRefs = (allCodeRefs ?? []).filter((r: any) => {
        const q = suggestion?.query ?? '';
        if (!q) return true;
        return (
            (r.label ?? '').toLowerCase().includes(q) ||
            r.file_path.toLowerCase().includes(q)
        );
    }).slice(0, 8);

    const insertCodeRef = useCallback((ref: any) => {
        if (!editor || !suggestion) return;
        const label = ref.label || `${ref.file_path}:${ref.line_start}-${ref.line_end}`;
        const { from } = editor.state.selection;
        const triggerLen = from - suggestion.triggerPos;
        editor.chain().focus()
            .deleteRange({ from: suggestion.triggerPos, to: suggestion.triggerPos + triggerLen })
            .insertContent(`{{${label}}}`)
            .run();
        setSuggestion(null);
    }, [editor, suggestion]);

    const filteredContributors = (contributors ?? []).filter((c: any) => {
        const q = contributorSuggestion?.query ?? '';
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    }).slice(0, 6);

    const insertContributor = useCallback((contributor: { name: string; email: string }) => {
        if (!editor || !contributorSuggestion) return;
        const { from } = editor.state.selection;
        const deleteLen = from - contributorSuggestion.triggerPos;
        editor.chain().focus()
            .deleteRange({ from: contributorSuggestion.triggerPos, to: contributorSuggestion.triggerPos + deleteLen })
            .insertContent(`@${contributor.name}`)
            .run();
        setContributorSuggestion(null);
    }, [editor, contributorSuggestion]);

    // Keep suggestion key handler up-to-date with latest state
    suggestionHandlerRef.current = (key: string) => {
        if (contributorSuggestion?.active) {
            if (key === 'Escape') { setContributorSuggestion(null); return true; }
            if (key === 'ArrowDown') { setContributorIndex((i) => i + 1); return true; }
            if (key === 'ArrowUp') { setContributorIndex((i) => Math.max(0, i - 1)); return true; }
            if (key === 'Enter' && filteredContributors.length > 0) {
                insertContributor(filteredContributors[contributorIndex % filteredContributors.length]);
                return true;
            }
            return false;
        }
        if (!suggestion?.active) return false;
        if (key === 'Escape') { setSuggestion(null); return true; }
        if (key === 'ArrowDown') { setSuggestionIndex((i) => i + 1); return true; }
        if (key === 'ArrowUp') { setSuggestionIndex((i) => Math.max(0, i - 1)); return true; }
        if (key === 'Enter' && filteredRefs.length > 0) {
            insertCodeRef(filteredRefs[suggestionIndex % filteredRefs.length]);
            return true;
        }
        return false;
    };

    const isEmpty = mode === 'wysiwyg' ? !editorHasContent : !rawMd;

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border bg-surface-1 flex-shrink-0">
                <Toolbar editor={editor} disabled={mode === 'markdown'} />

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mode toggle */}
                    <div className="flex items-center bg-surface-2 rounded-md p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={handleSwitchToWysiwyg}
                            className={cn(
                                'h-6 px-2.5 rounded transition-colors font-medium',
                                mode === 'wysiwyg'
                                    ? 'bg-surface text-text-primary shadow-sm'
                                    : 'text-text-muted hover:text-text-secondary',
                            )}
                        >
                            Visual
                        </button>
                        <button
                            type="button"
                            onClick={handleSwitchToMarkdown}
                            className={cn(
                                'h-6 px-2.5 rounded transition-colors font-medium font-mono',
                                mode === 'markdown'
                                    ? 'bg-surface text-text-primary shadow-sm'
                                    : 'text-text-muted hover:text-text-secondary',
                            )}
                        >
                            MD
                        </button>
                    </div>

                    {/* Save status icons */}
                    {saveStatus === 'saving' && (
                        <Loader2 size={13} className="text-text-muted animate-spin flex-shrink-0" />
                    )}
                    {saveStatus === 'saved' && (
                        <Check size={13} className="text-emerald-500 flex-shrink-0" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="tiptap-editor-wrap flex-1 relative overflow-auto">
                {mode === 'wysiwyg' ? (
                    <>
                        <EditorContent editor={editor} className="h-full" />

                        {/* / Contributor mention popup */}
                        {contributorSuggestion?.active && (
                            <div
                                className="absolute z-50 bg-surface border border-border rounded-lg shadow-lg overflow-hidden w-64"
                                style={{ top: contributorSuggestion.top, left: contributorSuggestion.left }}
                            >
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-surface-1">
                                    <AtSign size={11} className="text-primary" />
                                    <span className="text-xs text-text-muted">Mention a contributor</span>
                                </div>
                                {filteredContributors.map((c: any, i: number) => (
                                    <button
                                        key={c.email}
                                        onMouseDown={(e) => { e.preventDefault(); insertContributor(c); }}
                                        className={cn(
                                            'w-full text-left px-3 py-2 hover:bg-surface-1 transition-colors flex items-center gap-2',
                                            i === contributorIndex % Math.max(filteredContributors.length, 1) && 'bg-surface-1',
                                        )}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm text-text-primary truncate">{c.name}</p>
                                            <p className="text-xs text-text-muted truncate">{c.commits} commit{c.commits > 1 ? 's' : ''}</p>
                                        </div>
                                    </button>
                                ))}
                                {filteredContributors.length === 0 && (
                                    <p className="text-xs text-text-muted px-3 py-2">No contributor found</p>
                                )}
                            </div>
                        )}

                        {/* {{ }} Code ref suggestion popup */}
                        {suggestion?.active && (
                            <div
                                className="absolute z-50 bg-surface border border-border rounded-lg shadow-lg overflow-hidden w-72"
                                style={{ top: suggestion.top, left: suggestion.left }}
                            >
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-surface-1">
                                    <Braces size={11} className="text-primary" />
                                    <span className="text-xs text-text-muted">Code references</span>
                                </div>
                                {filteredRefs.map((ref: any, i: number) => (
                                    <button
                                        key={ref.id}
                                        onMouseDown={(e) => { e.preventDefault(); insertCodeRef(ref); }}
                                        className={cn(
                                            'w-full text-left px-3 py-2 hover:bg-surface-1 transition-colors',
                                            i === suggestionIndex % filteredRefs.length && 'bg-surface-1',
                                        )}
                                    >
                                        <p className="text-sm text-text-primary truncate">
                                            {ref.label || `${ref.file_path}:${ref.line_start}-${ref.line_end}`}
                                        </p>
                                        <p className="text-xs text-text-muted font-mono truncate">{ref.file_path} · L{ref.line_start}–{ref.line_end}</p>
                                    </button>
                                ))}
                                {filteredRefs.length === 0 && (
                                    <p className="text-xs text-text-muted px-3 py-2">No reference found</p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="relative h-full">
                        <textarea
                            value={rawMd}
                            onChange={(e) => handleRawMdChange(e.target.value)}
                            spellCheck={false}
                            className={cn(
                                'w-full h-full resize-none bg-transparent text-sm font-mono leading-relaxed',
                                'px-6 py-5 text-text-primary placeholder:text-text-muted',
                                'focus:outline-none',
                            )}
                            placeholder={'# Main heading\n\n## Section\n\nWrite markdown here...'}
                            style={{ tabSize: 2 }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
