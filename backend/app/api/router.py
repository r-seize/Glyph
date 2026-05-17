from fastapi import APIRouter
from app.api.routes import auth, users, workspaces, projects, files, commits, docs, search, webhooks, code_refs, github, gitlab, connected_accounts
from app.api.routes.invites import router as invites_router, workspace_invites_router

router = APIRouter(prefix="/api")

router.include_router(auth.router)
router.include_router(users.router)
router.include_router(workspaces.router)
router.include_router(workspace_invites_router, prefix="/workspaces")
router.include_router(projects.router)
router.include_router(files.router)
router.include_router(commits.router)
router.include_router(docs.router)
router.include_router(code_refs.router)
router.include_router(github.router)
router.include_router(gitlab.router)
router.include_router(search.router)
router.include_router(webhooks.router)
router.include_router(connected_accounts.router)
router.include_router(invites_router)