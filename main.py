import uvicorn
from api.api import create_app
from config.settings import settings

app = create_app()

if __name__ == "__main__":
    # Start the server (reload option enabled for development environment)
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=(settings.ENV == "development")
    )
