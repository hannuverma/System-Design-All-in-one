# Use an official lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file first to take advantage of Docker caching layers
COPY requirements.txt .

# Install the asyncpg and fastapi dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual Python application source code files into the container
COPY ./src ./src

# Inform Docker that the container listens on port 8000 at runtime
EXPOSE 8000

# Run uvicorn to start your FastAPI app. 
# --reload allows code changes to sync automatically without rebuilding the container.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]