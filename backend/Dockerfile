FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
COPY firebase-service-acc-credentials.json /app/firebase-service-acc-credentials.json
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]