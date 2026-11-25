FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app
RUN pip install --no-cache-dir poetry==2.5.2
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

EXPOSE 5000
CMD ["sh", "-c", "alembic upgrade head && gunicorn --bind 0.0.0.0:5000 'app:create_app()'"]
