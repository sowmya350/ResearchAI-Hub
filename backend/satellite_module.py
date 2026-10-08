"""Satellite image land-cover classification (EuroSAT, 10 classes).
Uses a fine-tuned ResNet18 if backend/satellite_model.pth exists (run train_eurosat.py).
Otherwise falls back to a simple colour-heuristic DEMO mode so the app still runs.
"""
import io
import os
import numpy as np
from PIL import Image, UnidentifiedImageError

CLASSES = ["AnnualCrop", "Forest", "HerbaceousVegetation", "Highway", "Industrial",
           "Pasture", "PermanentCrop", "Residential", "River", "SeaLake"]
WEIGHTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "satellite_model.pth")
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
_model = None


class ValidationError(ValueError):
    pass


def _load_model():
    global _model
    if _model is not None:
        return _model
    if not os.path.exists(WEIGHTS):
        return None
    import torch
    import torchvision
    m = torchvision.models.resnet18(weights=None)
    m.fc = torch.nn.Linear(m.fc.in_features, len(CLASSES))
    m.load_state_dict(torch.load(WEIGHTS, map_location="cpu"))
    m.eval()
    _model = m
    return m


def _open(file_bytes: bytes) -> Image.Image:
    try:
        Image.open(io.BytesIO(file_bytes)).verify()
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        raise ValidationError("File is not a valid image (use JPG/PNG).")
    if min(img.size) < 16:
        raise ValidationError("Image is too small (min 16x16).")
    return img


def _heuristic(img: Image.Image):
    a = np.asarray(img.resize((64, 64)), dtype=float) / 255.0
    r, g, b = a[..., 0].mean(), a[..., 1].mean(), a[..., 2].mean()
    bright = a.mean()
    sat = (a.max(-1) - a.min(-1)).mean()
    scores = {c: 0.02 for c in CLASSES}
    if b > r + 0.06 and b > g + 0.06:
        scores["SeaLake"] += 0.6; scores["River"] += 0.25
    elif g > r + 0.03 and g > b + 0.03:
        if bright < 0.3:
            scores["Forest"] += 0.6; scores["PermanentCrop"] += 0.2
        else:
            scores["Pasture"] += 0.35; scores["HerbaceousVegetation"] += 0.3; scores["AnnualCrop"] += 0.2
    elif sat < 0.12:
        scores["Highway"] += 0.3; scores["Industrial"] += 0.3; scores["Residential"] += 0.25
    else:
        scores["AnnualCrop"] += 0.45; scores["Residential"] += 0.2; scores["PermanentCrop"] += 0.15
    v = np.array([scores[c] for c in CLASSES])
    return v / v.sum()


def _colour_stats(img: Image.Image):
    arr = np.asarray(img.resize((128, 128)), dtype=float)
    hists = [np.histogram(arr[..., c], bins=16, range=(0, 256))[0] / arr[..., c].size * 100 for c in range(3)]
    rgb_hist = [{"bin": str(i * 16), "r": round(float(hists[0][i]), 2),
                 "g": round(float(hists[1][i]), 2), "b": round(float(hists[2][i]), 2)} for i in range(16)]
    mean_rgb = arr.reshape(-1, 3).mean(0).round(1).tolist()
    n = arr / 255.0
    exg = float(np.mean(2 * n[..., 1] - n[..., 0] - n[..., 2]))  # Excess Green vegetation index
    return rgb_hist, mean_rgb, round(exg, 3)


def predict(file_bytes: bytes) -> dict:
    img = _open(file_bytes)
    model = _load_model()
    if model is not None:
        import torch
        from torchvision import transforms as T
        tf = T.Compose([T.Resize((64, 64)), T.ToTensor(), T.Normalize(MEAN, STD)])
        with torch.no_grad():
            probs = torch.softmax(model(tf(img).unsqueeze(0)), dim=1)[0].numpy()
        mode, note = "model", "Prediction from fine-tuned ResNet18 (EuroSAT)."
    else:
        probs = _heuristic(img)
        mode = "demo"
        note = ("DEMO mode (colour heuristic). Run backend/train_eurosat.py to train the real "
                "PyTorch model, then restart the server.")
    order = np.argsort(probs)[::-1]
    all_probs = [{"label": CLASSES[i], "prob": round(float(probs[i]), 4)} for i in order]
    rgb_hist, mean_rgb, exg = _colour_stats(img)
    return {"label": all_probs[0]["label"], "confidence": all_probs[0]["prob"],
            "top3": all_probs[:3], "all_probs": all_probs,
            "rgb_hist": rgb_hist, "mean_rgb": mean_rgb, "vegetation_index": exg,
            "mode": mode, "note": note, "image_size": list(img.size)}
