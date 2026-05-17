from fastapi import APIRouter, Depends, Request, BackgroundTasks, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.project import Project
from app.services import github_service
from app.core.exceptions import NotFoundError, PermissionError
import logging

router  = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger  = logging.getLogger(__name__)


async def _handle_push(project_id: str, db: Session) -> None:
    """Background task: pull + sync commits after a GitHub push."""
    from app.api.routes.projects import _sync_project_task
    await _sync_project_task(project_id, db)


@router.post("/github/{project_id}", status_code=200)
async def github_webhook(
    project_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session                         = Depends(get_db),
    x_hub_signature_256: Optional[str]  = Header(None),
    x_github_event: Optional[str]       = Header(None),
):
    project = db.get(Project, project_id)
    if not project:
        raise NotFoundError("Project")

    payload = await request.body()

    # Verify HMAC signature if webhook secret is set
    if project.webhook_secret:
        if not x_hub_signature_256:
            raise PermissionError("Missing webhook signature")
        if not github_service.verify_webhook_signature(
            payload, x_hub_signature_256, project.webhook_secret
        ):
            raise PermissionError("Invalid webhook signature")

    # Only handle push events
    if x_github_event != "push":
        return {"status": "ignored", "event": x_github_event}

    logger.info(f"Received push webhook for project {project_id}")
    background_tasks.add_task(_handle_push, project_id, db)

    return {"status": "queued"}