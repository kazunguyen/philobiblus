"""Request correlation, JSON logs, and optional OpenTelemetry export."""

import json
import logging
import os
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy.engine import Engine
from starlette.middleware.base import BaseHTTPMiddleware


REQUEST_ID = ContextVar("request_id", default="")
LOGGER = logging.getLogger("philobiblus.request")


def _enabled(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Emit one safe, structured log record per application request."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = REQUEST_ID.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            LOGGER.exception(json.dumps({"event": "http_request_failed", "request_id": request_id, "method": request.method, "path": request.url.path}))
            raise
        finally:
            REQUEST_ID.reset(token)

        response.headers["X-Request-ID"] = request_id
        LOGGER.info(json.dumps({"event": "http_request_completed", "request_id": request_id, "method": request.method, "path": request.url.path, "status_code": response.status_code, "duration_ms": round((time.perf_counter() - started) * 1000, 2)}))
        return response


def configure_observability(app: FastAPI, engine: Engine) -> None:
    """Keep logs local by default; export spans only when an endpoint is set."""
    app.add_middleware(RequestLogMiddleware)
    if not _enabled("OTEL_TRACING_ENABLED"):
        return

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        raise RuntimeError("OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_TRACING_ENABLED=true")

    provider = TracerProvider(resource=Resource.create({SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "philobiblus-backend")}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True)))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="/health,/metrics")
    SQLAlchemyInstrumentor().instrument(engine=engine)
