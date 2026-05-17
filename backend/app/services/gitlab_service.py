import httpx
from typing import Optional
from app.config import settings


async def exchange_code_for_token(code: str, redirect_uri: str) -> Optional[str]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.gitlab_oauth_url}/token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.gitlab_client_id,
                "client_secret": settings.gitlab_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        data = response.json()
        return data.get("access_token")


async def get_gitlab_user(access_token: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.gitlab_api_url}/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code != 200:
            return None
        return response.json()


async def list_repos(access_token: str) -> list[dict]:
    repos  = []
    page   = 1
    async with httpx.AsyncClient() as client:
        while True:
            response = await client.get(
                f"{settings.gitlab_api_url}/projects",
                headers  = {"Authorization": f"Bearer {access_token}"},
                params   = {"membership": "true", "per_page": 100, "page": page, "order_by": "last_activity_at"},
            )
            if response.status_code != 200:
                break
            data = response.json()
            if not data:
                break
            for repo in data:
                repos.append({
                    "name": repo["name"],
                    "full_name": repo["path_with_namespace"],
                    "description": repo.get("description"),
                    "clone_url": repo["http_url_to_repo"],
                    "html_url": repo["web_url"],
                    "default_branch": repo.get("default_branch", "main"),
                    "private": repo.get("visibility") != "public",
                    "language": None,
                    "stars": repo.get("star_count", 0),
                    "updated_at": repo.get("last_activity_at"),
                })
            if len(data) < 100:
                break
            page += 1
    return repos
