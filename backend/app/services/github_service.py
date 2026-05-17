import hashlib
import hmac
import httpx
from typing import Optional
from app.config import settings


async def exchange_code_for_token(code: str) -> Optional[str]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.github_oauth_url}/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
        )
        data = response.json()
        return data.get("access_token")


async def get_github_user(access_token: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.github_api_url}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
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
                f"{settings.github_api_url}/user/repos",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
                params={"per_page": 100, "page": page, "sort": "updated"},
            )
            if response.status_code != 200:
                break
            data = response.json()
            if not data:
                break
            for repo in data:
                repos.append({
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo.get("description"),
                    "clone_url": repo["clone_url"],
                    "html_url": repo["html_url"],
                    "default_branch": repo.get("default_branch", "main"),
                    "private": repo["private"],
                    "language": repo.get("language"),
                    "stars": repo.get("stargazers_count", 0),
                    "updated_at": repo.get("updated_at"),
                })
            if len(data) < 100:
                break
            page += 1
    return repos


async def get_repo_info(owner: str, repo: str, access_token: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.github_api_url}/repos/{owner}/{repo}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if response.status_code != 200:
            return None
        data = response.json()
        return {
            "name": data["name"],
            "full_name": data["full_name"],
            "description": data.get("description"),
            "clone_url": data["clone_url"],
            "default_branch": data.get("default_branch", "main"),
            "private": data["private"],
        }


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        msg        = payload,
        digestmod  = hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def create_webhook(owner: str, repo: str, access_token: str, webhook_url: str, secret: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.github_api_url}/repos/{owner}/{repo}/hooks",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            json={
                "name": "web",
                "active": True,
                "events": ["push"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": secret,
                },
            },
        )
        if response.status_code not in (200, 201):
            return None
        return response.json()