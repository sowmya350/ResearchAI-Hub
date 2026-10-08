# ResearchAI Hub  (React + FastAPI + PyTorch)

Flow implemented:
User -> Login/Register -> Select Research Module -> Upload Dataset/Image -> Validation ->
Preprocessing -> AI/ML model -> Analysis & Prediction -> Results & Visualizations -> Download / Save (History)

Modules: Gene Expression (Biology), Satellite Images (Geoscience), Dataset Explorer (Other Research Tools)

## Run backend (Terminal 1)
    cd backend
    python -m venv venv
    venv\Scripts\activate          # Mac/Linux: source venv/bin/activate
    pip install -r requirements.txt
    python make_sample_data.py     # (optional) re-creates the CSVs in ../samples
    uvicorn main:app --reload --port 8000

## Run frontend (Terminal 2)
    cd frontend
    npm install
    npm run dev                    # open http://localhost:5173

## Use
1. Register an account (username + password), you are logged in automatically.
2. Pick a module. Upload a file from the `samples` folder.
3. Every result is saved to History (SQLite file backend/researchai.db).

## Train the real satellite model (optional, recommended)
    cd backend
    python train_eurosat.py        # creates satellite_model.pth ; restart uvicorn afterwards

## Deploy to the cloud (Docker, one service)
The Dockerfile builds the React app and serves it from FastAPI: one URL, no CORS setup.

Test locally first (needs Docker Desktop):
    docker build -t researchai-hub .
    docker run -p 8000:8000 -e RESEARCHAI_SECRET=my-long-random-secret researchai-hub
    # open http://localhost:8000

Environment variables:
    RESEARCHAI_SECRET  required in production (signs login tokens)
    RESEARCHAI_DB      optional, path of the SQLite file (point at a persistent disk)
    CORS_ORIGINS       optional, only if the frontend is hosted on another domain
    WITH_TORCH=1       docker build arg: installs PyTorch so a trained satellite_model.pth is used

Render: push this folder to GitHub -> Render -> New -> Blueprint (reads render.yaml) -> Deploy.
