FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
# Packaging sources must be present for `pip install .` (setuptools installs
# the app/agents/evals packages + db module); tests and the rest follow after
# so dependency installation still layer-caches on pyproject-only changes.
COPY app ./app
COPY agents ./agents
COPY evals ./evals
COPY db.py ./
COPY db_models.py ./
RUN pip install --upgrade pip && pip install .

COPY . .

EXPOSE 8000
# Railway injects $PORT; default 8000 for local `docker run` / compose.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
