# ---- Stage 1: build the React frontend ----
FROM node:20-slim AS fe
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.11-slim
WORKDIR /app
# WITH_TORCH=1 installs PyTorch (CPU) so a trained satellite_model.pth can be used.
# Default 0 = smaller, faster image; the satellite module then runs in demo mode.
ARG WITH_TORCH=0
COPY backend/requirements-cloud.txt .
RUN pip install --no-cache-dir -r requirements-cloud.txt
RUN if [ "$WITH_TORCH" = "1" ]; then pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu; fi
COPY backend/ .
COPY --from=fe /fe/dist ./static
ENV PORT=8000
EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
