import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from middleware.auth import verify_hmac
from adapters.glpi import router as glpi_router
from adapters.erp import router as erp_router
from adapters.m365 import router as m365_router
from adapters.state import router as state_router, init_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        init_schema()
    except Exception as e:
        logging.warning("Could not init schema: %s", e)
    yield
    # Shutdown (nothing to do)


app = FastAPI(
    title="AutomIT Tool Gateway",
    version="1.0.0",
    lifespan=lifespan,
)


class HMACAuthMiddleware(BaseHTTPMiddleware):
    """Verify HMAC signature on all requests except /health."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        signature = request.headers.get("X-Signature")
        body = await request.body()
        if not verify_hmac(signature or "", body):
            return Response(content='{"error":"invalid signature"}', status_code=401,
                            media_type="application/json")
        return await call_next(request)


app.add_middleware(HMACAuthMiddleware)

app.include_router(glpi_router, prefix="/glpi", tags=["GLPI"])
app.include_router(erp_router, prefix="/erp", tags=["ERP"])
app.include_router(m365_router, prefix="/m365", tags=["M365"])
app.include_router(state_router, prefix="/state", tags=["State"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "automit-tool-gateway"}
