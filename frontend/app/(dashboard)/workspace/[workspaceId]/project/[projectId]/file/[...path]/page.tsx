'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useProject } from '@/hooks/useProject';
import { useFileContent } from '@/hooks/useFileTree';
import { useFileCommits } from '@/hooks/useCommits';
import { useDoc } from '@/hooks/useDoc';
import { useCodeRefs } from '@/hooks/useCodeRefs';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import FileTree from '@/components/project/FileTree';
import CodeViewer, { CodeViewerHandle, LineSelection } from '@/components/code/CodeViewer';
import CodeReferencesPanel from '@/components/code/CodeReferencesPanel';
import CommitSelector from '@/components/code/CommitSelector';
import BranchSelector from '@/components/code/BranchSelector';
import DocEditor from '@/components/docs/DocEditor';
import CommentThread from '@/components/docs/CommentThread';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ResizableHandle from '@/components/ui/ResizableHandle';
import { getLanguageColor } from '@/lib/utils';
import { Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CodeReference, Workspace } from '@/types';
import { useBranches } from '@/hooks/useProject';

const DOC_WIDTH_KEY = 'glyph-doc-panel-width';
const DOC_WIDTH_MIN = 320;
const DOC_WIDTH_DEFAULT = 420;

function clampWidth(w: number) {
    if (typeof window === 'undefined') return w;
    const max = Math.max(DOC_WIDTH_MIN, window.innerWidth - 480);
    return Math.min(Math.max(w, DOC_WIDTH_MIN), max);
}

export default function FilePage({ params }: { params: Promise<{ workspaceId: string; projectId: string; path: string[] }> }) {
    const { workspaceId, projectId, path } = use(params);
    const filePath = path.map(decodeURIComponent).join('/');
    const router = useRouter();

    const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'];
    const fileExt = filePath.split('.').pop()?.toLowerCase() ?? '';
    const isImage = IMAGE_EXTENSIONS.includes(fileExt);

    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [selectedSha, setSelectedSha] = useState<string | undefined>();
    const [docPanelOpen, setDocPanelOpen] = useState(true);
    const [docWidth, setDocWidth] = useState(() => {
        if (typeof window === 'undefined') return DOC_WIDTH_DEFAULT;
        const stored = Number(localStorage.getItem(DOC_WIDTH_KEY));
        return stored && !Number.isNaN(stored) ? clampWidth(stored) : DOC_WIDTH_DEFAULT;
    });
    const [selection, setSelection] = useState<LineSelection | null>(null);
    const [highlightedRefId, setHighlightedRefId] = useState<string | null>(null);
    const codeViewerRef = useRef<CodeViewerHandle>(null);

    useEffect(() => {
        const onResize = () => setDocWidth((w) => clampWidth(w));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        setSelection(null);
        setSelectedSha(undefined);
    }, [filePath, selectedBranch]);

    const { data: project } = useProject(projectId);
    const { data: branches } = useBranches(projectId);
    const branch = selectedBranch ?? project?.default_branch ?? 'main';
    const { data: workspace } = useQuery<Workspace>({
        queryKey: ['workspace', workspaceId],
        queryFn: async () => { const res = await workspacesApi.get(workspaceId); return res.data; },
    });

    const { data: commits, isLoading: commitsLoading } = useFileCommits(projectId, filePath, branch);
    const currentSha = selectedSha || commits?.[0]?.sha || '';

    const { data: fileData, isLoading: fileLoading } = useFileContent(projectId, filePath, currentSha);
    const { data: doc } = useDoc(projectId, filePath, currentSha);
    const { data: references } = useCodeRefs(projectId, filePath, currentSha);

    const breadcrumbs = [
        { label: workspace?.name || 'Workspace', href: `/workspace/${workspaceId}` },
        { label: project?.name || 'Project', href: `/workspace/${workspaceId}/project/${projectId}` },
        { label: filePath },
    ];

    const handleResize = (delta: number) => {
        setDocWidth((w) => {
            const next = clampWidth(w - delta);
            localStorage.setItem(DOC_WIDTH_KEY, String(next));
            return next;
        });
    };

    const handleLineClick = (line: number, withShift: boolean) => {
        if (!docPanelOpen) setDocPanelOpen(true);
        setSelection((prev) => {
            const set = new Set(prev ?? []);
            if (withShift && prev && prev.length > 0) {
                // Range-add from last selected line
                const last = prev[prev.length - 1];
                const lo = Math.min(last, line);
                const hi = Math.max(last, line);
                for (let l = lo; l <= hi; l++) set.add(l);
            } else {
                // Toggle single line
                if (set.has(line)) set.delete(line);
                else set.add(line);
            }
            const result = Array.from(set).sort((a, b) => a - b);
            return result.length > 0 ? result : null;
        });
    };

    const handleRefClick = (ref: CodeReference) => {
        codeViewerRef.current?.scrollToLine(ref.line_start);
        setHighlightedRefId(ref.id);
        setTimeout(() => setHighlightedRefId((h) => (h === ref.id ? null : h)), 1500);
    };

    return (
        <>
            <Topbar breadcrumbs={breadcrumbs} />
            <div className="pt-12 flex h-screen overflow-hidden">
                {/* File tree */}
                <aside className="w-56 border-r border-border bg-surface-1 flex flex-col flex-shrink-0 overflow-hidden">
                    <div className="px-2 py-2 border-b border-border">
                        {branches && branches.length > 0 ? (
                            <BranchSelector
                                branches={branches}
                                selected={branch}
                                onSelect={(b) => setSelectedBranch(b)}
                                className="w-full"
                            />
                        ) : (
                            <span className="text-xs text-text-muted font-mono px-1">{branch}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {project && (
                            <FileTree
                                projectId={projectId}
                                activePath={filePath}
                                onSelect={(p) => router.push(`/workspace/${workspaceId}/project/${projectId}/file/${p.split('/').map(encodeURIComponent).join('/')}`)}
                            />
                        )}
                    </div>
                </aside>

                {/* Code panel */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    {/* Code toolbar */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-mono text-text-primary truncate">{filePath}</span>
                            {fileData?.language && (
                                <Badge variant="language" color={getLanguageColor(fileData.language)}>
                                    {fileData.language}
                                </Badge>
                            )}
                            {references && references.length > 0 && (
                                <Badge variant="documented">
                                    {references.length} ref{references.length > 1 ? 's' : ''}
                                </Badge>
                            )}
                        </div>
                        {commits && commits.length > 0 && (
                            <CommitSelector
                                commits={commits}
                                selectedSha={currentSha}
                                onSelect={setSelectedSha}
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDocPanelOpen(!docPanelOpen)}
                            title={docPanelOpen ? 'Hide doc' : 'Show doc'}
                        >
                            {docPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                        </Button>
                    </div>

                    {/* Code content */}
                    <div className="flex-1 overflow-auto">
                        {fileLoading || commitsLoading ? (
                            <div className="flex items-center justify-center h-full text-text-muted">
                                <Loader2 size={20} className="animate-spin" />
                            </div>
                        ) : isImage ? (
                            <div className="flex items-center justify-center h-full p-8">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`/api/files/${projectId}/raw?path=${encodeURIComponent(filePath)}${currentSha ? `&commit=${currentSha}` : ''}`}
                                    alt={filePath}
                                    className="max-w-full max-h-full object-contain rounded-lg"
                                />
                            </div>
                        ) : fileData ? (
                            <CodeViewer
                                ref={codeViewerRef}
                                content={fileData.content}
                                language={fileData.language}
                                className="h-full"
                                references={references || []}
                                selection={selection}
                                highlightedRefId={highlightedRefId}
                                onLineClick={handleLineClick}
                                onRefClick={(ref) => {
                                    setHighlightedRefId(ref.id);
                                    setTimeout(() => setHighlightedRefId(null), 1500);
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-sm text-text-muted">
                                File not found
                            </div>
                        )}
                    </div>
                </div>

                {/* Resizable handle */}
                {docPanelOpen && <ResizableHandle onResize={handleResize} />}

                {/* Doc panel */}
                {docPanelOpen && (
                    <div
                        className="flex flex-col overflow-hidden flex-shrink-0 border-l border-border"
                        style={{ width: `${docWidth}px` }}
                    >
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
                            <span className="text-sm font-medium text-text-secondary">Documentation</span>
                            {doc && (
                                <Badge variant="documented">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                                    Documented
                                </Badge>
                            )}
                        </div>

                        {currentSha && (
                            <CodeReferencesPanel
                                projectId={projectId}
                                filePath={filePath}
                                commitSha={currentSha}
                                references={references || []}
                                selection={selection}
                                onSelectionClear={() => setSelection(null)}
                                onSelectionSet={setSelection}
                                onRefHover={setHighlightedRefId}
                                onRefClick={handleRefClick}
                            />
                        )}

                        <div className="flex-1 overflow-hidden">
                            {currentSha ? (
                                <DocEditor
                                    projectId={projectId}
                                    filePath={filePath}
                                    commitSha={currentSha}
                                    initialContent={doc?.content}
                                    onRefClick={handleRefClick}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-sm text-text-muted">
                                    Select a commit
                                </div>
                            )}
                        </div>

                        {currentSha && <CommentThread projectId={projectId} filePath={filePath} commitSha={currentSha} />}
                    </div>
                )}
            </div>
        </>
    );
}
