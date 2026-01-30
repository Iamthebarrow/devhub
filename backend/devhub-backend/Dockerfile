FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

# Copy project
COPY . .

RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8888

ENTRYPOINT ["/app/entrypoint.sh"]

# Default command (development)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8888"]
