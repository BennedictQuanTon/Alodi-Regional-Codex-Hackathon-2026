import sys

import uvicorn

from app.integrated import create_integrated_app
from app.settings import ConfigurationError, load_settings


def serve() -> None:
    try:
        settings = load_settings()
        app = create_integrated_app(settings)
    except ConfigurationError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from None
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)


if __name__ == "__main__":
    serve()
