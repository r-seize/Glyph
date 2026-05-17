from fastapi import Request
from fastapi.responses import JSONResponse


class GlyphException(Exception):
    def __init__(self, message: str, code: str = "error", status_code: int = 400):
        self.message      = message
        self.code         = code
        self.status_code  = status_code
        super().__init__(message)


class NotFoundError(GlyphException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            message      = f"{resource} not found",
            code         = "not_found",
            status_code  = 404,
        )


class PermissionError(GlyphException):
    def __init__(self, message: str = "You don't have permission to perform this action"):
        super().__init__(message=message, code="forbidden", status_code=403)


class ConflictError(GlyphException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message=message, code="conflict", status_code=409)


class UnauthorizedError(GlyphException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message=message, code="unauthorized", status_code=401)


class ValidationError(GlyphException):
    def __init__(self, message: str):
        super().__init__(message=message, code="validation_error", status_code=422)


async def glyph_exception_handler(request: Request, exc: GlyphException):
    return JSONResponse(
        status_code  = exc.status_code,
        content      = {"detail": exc.message, "code": exc.code},
    )