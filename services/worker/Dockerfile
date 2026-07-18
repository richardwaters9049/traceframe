FROM python:3.14.5-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd --create-home --uid 10001 traceframe

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=traceframe:traceframe src ./src

ENV PYTHONPATH=/app/src
USER traceframe

CMD ["python", "-m", "traceframe_worker"]
