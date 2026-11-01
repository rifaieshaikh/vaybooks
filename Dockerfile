FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-api.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-api.txt

COPY . .

ENV MONGODB_URI="" \
    MONGODB_DATABASE="zahcci_customization" \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["python", "-m", "services.combined", "--host", "0.0.0.0", "--port", "8000"]
