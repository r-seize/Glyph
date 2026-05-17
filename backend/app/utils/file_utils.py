import os
import re
from app.config import settings

LANGUAGE_MAP = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".tsx": "TypeScript", ".jsx": "JavaScript", ".vue": "Vue",
    ".go": "Go", ".rs": "Rust", ".java": "Java", ".kt": "Kotlin",
    ".rb": "Ruby", ".php": "PHP", ".cs": "C#", ".cpp": "C++",
    ".c": "C", ".h": "C", ".swift": "Swift", ".dart": "Dart",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".sass": "SASS",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".md": "Markdown", ".mdx": "MDX", ".sql": "SQL", ".sh": "Shell",
    ".bash": "Shell", ".zsh": "Shell", ".dockerfile": "Docker",
    ".tf": "Terraform", ".r": "R", ".m": "MATLAB",
}


def get_repo_path(project_id: str) -> str:
    return os.path.join(settings.repos_dir, project_id)


def get_doc_path(project_id: str, file_path: str, commit_sha: str) -> str:
    safe_path = file_path.replace("/", "__").replace("\\", "__")
    return os.path.join(settings.docs_dir, project_id, commit_sha, f"{safe_path}.md")


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def language_from_extension(file_path: str) -> str:
    _, ext = os.path.splitext(file_path.lower())
    filename = os.path.basename(file_path.lower())
    if filename in ("dockerfile", "makefile", "jenkinsfile"):
        return filename.capitalize()
    return LANGUAGE_MAP.get(ext, "Text")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text


def is_binary_file(file_path: str) -> bool:
    binary_extensions = {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
        ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
        ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
        ".mp3", ".mp4", ".wav", ".avi", ".mov",
        ".ttf", ".woff", ".woff2", ".eot",
        ".pyc", ".pyo", ".db", ".sqlite",
    }
    _, ext = os.path.splitext(file_path.lower())
    return ext in binary_extensions