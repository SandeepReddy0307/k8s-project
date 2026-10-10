FROM python:3.12-slim
WORKDIR /app
COPY app/recommendation-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 1000 --create-home app
COPY --chown=1000:1000 app/recommendation-service/src ./src
ENV PORT=8080 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 1000:1000
EXPOSE 8080
CMD ["gunicorn", "--chdir", "src", "--workers", "2", "--threads", "4", "--timeout", "30", "--worker-tmp-dir", "/tmp", "-b", "0.0.0.0:8080", "app:app"]
