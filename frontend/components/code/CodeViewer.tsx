'use client';

import { CSSProperties, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CodeReference } from '@/types';
import { refColorAt } from '@/lib/refColors';
import hljs from 'highlight.js/lib/core';
import langBash from 'highlight.js/lib/languages/bash';
import langC from 'highlight.js/lib/languages/c';
import langCpp from 'highlight.js/lib/languages/cpp';
import langCsharp from 'highlight.js/lib/languages/csharp';
import langCss from 'highlight.js/lib/languages/css';
import langDiff from 'highlight.js/lib/languages/diff';
import langGo from 'highlight.js/lib/languages/go';
import langHtml from 'highlight.js/lib/languages/xml';
import langJava from 'highlight.js/lib/languages/java';
import langJs from 'highlight.js/lib/languages/javascript';
import langJson from 'highlight.js/lib/languages/json';
import langKotlin from 'highlight.js/lib/languages/kotlin';
import langPhp from 'highlight.js/lib/languages/php';
import langPy from 'highlight.js/lib/languages/python';
import langRuby from 'highlight.js/lib/languages/ruby';
import langRust from 'highlight.js/lib/languages/rust';
import langScss from 'highlight.js/lib/languages/scss';
import langShell from 'highlight.js/lib/languages/shell';
import langSql from 'highlight.js/lib/languages/sql';
import langSwift from 'highlight.js/lib/languages/swift';
import langTs from 'highlight.js/lib/languages/typescript';
import langYaml from 'highlight.js/lib/languages/yaml';
import langToml from 'highlight.js/lib/languages/ini';
import langMarkdown from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('bash', langBash);
hljs.registerLanguage('c', langC);
hljs.registerLanguage('cpp', langCpp);
hljs.registerLanguage('csharp', langCsharp);
hljs.registerLanguage('css', langCss);
hljs.registerLanguage('diff', langDiff);
hljs.registerLanguage('go', langGo);
hljs.registerLanguage('html', langHtml);
hljs.registerLanguage('xml', langHtml);
hljs.registerLanguage('java', langJava);
hljs.registerLanguage('javascript', langJs);
hljs.registerLanguage('json', langJson);
hljs.registerLanguage('kotlin', langKotlin);
hljs.registerLanguage('php', langPhp);
hljs.registerLanguage('python', langPy);
hljs.registerLanguage('ruby', langRuby);
hljs.registerLanguage('rust', langRust);
hljs.registerLanguage('scss', langScss);
hljs.registerLanguage('shell', langShell);
hljs.registerLanguage('sql', langSql);
hljs.registerLanguage('swift', langSwift);
hljs.registerLanguage('typescript', langTs);
hljs.registerLanguage('yaml', langYaml);
hljs.registerLanguage('toml', langToml);
hljs.registerLanguage('ini', langToml);
hljs.registerLanguage('markdown', langMarkdown);

const LANG_ALIAS: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', pyi: 'python',
    rs: 'rust',
    rb: 'ruby',
    sh: 'bash', zsh: 'bash', fish: 'bash',
    kt: 'kotlin', kts: 'kotlin',
    cs: 'csharp',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp',
    yml: 'yaml',
    md: 'markdown', mdx: 'markdown',
    dockerfile: 'bash',
    toml: 'toml', ini: 'toml',
    html: 'html', htm: 'html',
};

function resolveLanguage(lang?: string): string | null {
    if (!lang) return null;
    const l = lang.toLowerCase();
    return LANG_ALIAS[l] || (hljs.getLanguage(l) ? l : null);
}

/**
 * Split highlight.js HTML output into per-line arrays,
 * preserving open <span> tags across line boundaries.
 */
function splitHlLines(html: string): string[] {
    const lines: string[] = [];
    let current = '';
    const openStack: string[] = [];
    let i = 0;

    while (i < html.length) {
        if (html[i] === '\n') {
            lines.push(current + openStack.map(() => '</span>').join(''));
            current = openStack.join('');
            i++;
        } else if (html[i] === '<') {
            if (html.startsWith('</span>', i)) {
                openStack.pop();
                current += '</span>';
                i += 7;
            } else if (html.startsWith('<span', i)) {
                const end = html.indexOf('>', i);
                const tag = html.slice(i, end + 1);
                openStack.push(tag);
                current += tag;
                i = end + 1;
            } else {
                current += html[i];
                i++;
            }
        } else {
            current += html[i];
            i++;
        }
    }
    if (current) lines.push(current);
    return lines;
}

// Array of selected line numbers (can be non-contiguous)
export type LineSelection = number[];

interface CodeViewerProps {
    content: string;
    language?: string;
    className?: string;
    references?: CodeReference[];
    selection?: LineSelection | null;
    highlightedRefId?: string | null;
    onLineClick?: (line: number, withShift: boolean) => void;
    onRefClick?: (ref: CodeReference) => void;
}

export interface CodeViewerHandle {
    scrollToLine: (line: number) => void;
}


interface LineMeta {
    refs: { ref: CodeReference; index: number }[];
    inSelection: boolean;
}

const CodeViewer = forwardRef<CodeViewerHandle, CodeViewerProps>(function CodeViewer(
    { content, language, className, references, selection, highlightedRefId, onLineClick, onRefClick },
    ref
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

    useImperativeHandle(ref, () => ({
        scrollToLine: (line: number) => {
            const row = rowRefs.current.get(line);
            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
    }));

    const highlightedLines = useMemo(() => {
        const lang = resolveLanguage(language);
        if (!lang || !content) return content.split('\n').map((t) => ({ __html: t || ' ' }));
        try {
            const result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
            return splitHlLines(result.value).map((html) => ({ __html: html || ' ' }));
        } catch {
            return content.split('\n').map((t) => ({ __html: t || ' ' }));
        }
    }, [content, language]);

    const selectionSet = useMemo(() => new Set(selection ?? []), [selection]);

    const lineMetas = useMemo(() => {
        const map = new Map<number, LineMeta>();
        const refs = references || [];
        refs.forEach((r, idx) => {
            // Use explicit lines array if present, otherwise fall back to contiguous range
            const lines = r.lines && r.lines.length > 0
                ? r.lines
                : Array.from({ length: r.line_end - r.line_start + 1 }, (_, i) => r.line_start + i);
            for (const l of lines) {
                const meta = map.get(l) || { refs: [], inSelection: false };
                meta.refs.push({ ref: r, index: idx });
                map.set(l, meta);
            }
        });
        for (const l of selectionSet) {
            const meta = map.get(l) || { refs: [], inSelection: false };
            meta.inSelection = true;
            map.set(l, meta);
        }
        return map;
    }, [references, selectionSet]);

    return (
        <div
            ref={containerRef}
            className={cn('overflow-auto bg-surface font-mono text-sm leading-relaxed hljs-glyph', className)}
        >
            <table className="w-full border-collapse">
                <tbody>
                    {highlightedLines.map((lineHtml, i) => {
                        const lineNumber = i + 1;
                        const meta = lineMetas.get(lineNumber);
                        const topRef = meta?.refs[meta.refs.length - 1]; // last ref wins on overlap
                        const refColors = topRef ? refColorAt(topRef.index, topRef.ref.color) : null;
                        const bgColor = refColors?.background;
                        const isHighlighted = topRef && highlightedRefId === topRef.ref.id;
                        const borderColor = refColors?.border;

                        return (
                            <tr
                                key={i}
                                ref={(el) => {
                                    if (el) rowRefs.current.set(lineNumber, el);
                                    else rowRefs.current.delete(lineNumber);
                                }}
                                data-line={lineNumber}
                                className={cn(
                                    'group transition-colors',
                                    !bgColor && 'hover:bg-black/[0.025] dark:hover:bg-white/[0.025]'
                                )}
                                style={{
                                    '--ref-flash-color': borderColor,
                                    '--ref-flash-color-alpha': borderColor?.replace('rgb(', 'rgba(').replace(')', ', 0.35)'),
                                    '--ref-flash-bg': bgColor ?? 'transparent',
                                    backgroundColor: meta?.inSelection
                                        ? 'rgba(59, 130, 246, 0.12)'
                                        : bgColor,
                                    boxShadow: isHighlighted
                                        ? undefined
                                        : topRef
                                        ? `inset 2px 0 0 ${borderColor}`
                                        : undefined,
                                    animation: isHighlighted
                                        ? 'ref-border-flash 0.4s ease-in-out 4'
                                        : undefined,
                                } as CSSProperties}
                            >
                                <td
                                    onClick={(e) => onLineClick?.(lineNumber, e.shiftKey)}
                                    onDoubleClick={() => topRef && onRefClick?.(topRef.ref)}
                                    className={cn(
                                        'select-none text-right pr-4 pl-4 text-text-muted w-12 min-w-[48px] border-r border-border sticky left-0 bg-surface',
                                        onLineClick && 'cursor-pointer hover:text-text-primary',
                                        meta?.inSelection && 'bg-blue-100 dark:bg-blue-900/30 text-text-primary',
                                        bgColor && !meta?.inSelection && 'bg-surface'
                                    )}
                                    title={
                                        topRef
                                            ? `Reference: ${topRef.ref.label || `Lines ${topRef.ref.line_start}-${topRef.ref.line_end}`}`
                                            : onLineClick
                                            ? 'Click to select / deselect · Shift+click to select a range'
                                            : undefined
                                    }
                                >
                                    {lineNumber}
                                </td>
                                <td
                                    className="pl-4 pr-4 whitespace-pre"
                                    dangerouslySetInnerHTML={lineHtml}
                                />
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
});

export default CodeViewer;
