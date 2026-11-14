FROM python:3.12-slim
WORKDIR /app
COPY avalon_app.zip /tmp/avalon_app.zip
RUN python -m zipfile -e /tmp/avalon_app.zip /app && pip install --no-cache-dir -r /app/requirements.txt && rm /tmp/avalon_app.zip
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
