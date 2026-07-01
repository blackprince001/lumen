"""Global HTTP error envelope: {code, message, detail}.

`detail` mirrors `message` for compatibility with clients reading FastAPI's
default shape; validation errors add an `errors` list.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logger import get_logger

logger = get_logger(__name__)

_STATUS_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMIT",
  500: "INTERNAL_ERROR",
  502: "UPSTREAM_ERROR",
  503: "SERVICE_UNAVAILABLE",
  504: "UPSTREAM_TIMEOUT",
}


def _code_for_status(status: int) -> str:
  return _STATUS_CODES.get(status, "CLIENT_ERROR" if status < 500 else "SERVER_ERROR")


def _envelope(status: int, message: str, **extra) -> JSONResponse:
  return JSONResponse(
    status_code=status,
    content={
      "code": _code_for_status(status),
      "message": message,
      "detail": message,
      **extra,
    },
  )


def register_exception_handlers(app: FastAPI) -> None:
  @app.exception_handler(StarletteHTTPException)
  async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    response = _envelope(exc.status_code, message)
    if exc.headers:
      response.headers.update(exc.headers)
    return response

  @app.exception_handler(RequestValidationError)
  async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return _envelope(422, "Request validation failed", errors=exc.errors())

  @app.exception_handler(Exception)
  async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
      "Unhandled exception", path=str(request.url.path), method=request.method
    )
    return _envelope(500, "Internal server error")
