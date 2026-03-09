from fastapi import FastAPI
from adapters.glpi import router as glpi_router
from adapters.erp import router as erp_router
from adapters.m365 import router as m365_router

app = FastAPI(title="AutomIT Tool Gateway", version="1.0.0")

app.include_router(glpi_router, prefix="/glpi", tags=["GLPI"])
app.include_router(erp_router, prefix="/erp", tags=["ERP"])
app.include_router(m365_router, prefix="/m365", tags=["M365"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "automit-tool-gateway"}
