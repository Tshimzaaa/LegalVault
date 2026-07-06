from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(
    title="Legal Practice Management API",
    version="1.0.0"
)
@app.get("/")
def root():
    return {
        "status": "running!",
        "project": "Legal Practice Management API"
    }




@app.get("/config-test")
def config_test():
    return {
        "database": settings.DATABASE_URL,
        "algorithm": settings.ALGORITHM
    }