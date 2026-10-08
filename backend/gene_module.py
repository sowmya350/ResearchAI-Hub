"""Gene Expression Analysis for cancer diagnosis.
CSV format: one row per sample, one column per gene, plus a label column
(named label / class / diagnosis / target / status) with exactly 2 classes.
"""
import io
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_predict

LABEL_NAMES = ("label", "class", "diagnosis", "target", "status")


class ValidationError(ValueError):
    pass


def _bh(p):
    """Benjamini-Hochberg FDR correction."""
    p = np.asarray(p, dtype=float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / (np.arange(n) + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.clip(ranked, 0, 1)
    return out


def analyze(file_bytes: bytes) -> dict:
    # 1. Validate
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception:
        raise ValidationError("File is not a readable CSV.")
    label_col = next((c for c in df.columns if str(c).strip().lower() in LABEL_NAMES), None)
    if label_col is None:
        raise ValidationError("No label column found. Name it one of: " + ", ".join(LABEL_NAMES))
    df = df[df[label_col].notna()]
    y = df[label_col].astype(str).str.strip().values
    classes = sorted(set(y))
    if len(classes) != 2:
        raise ValidationError(f"Label column must have exactly 2 classes, found {len(classes)}.")
    counts = pd.Series(y).value_counts()
    if counts.min() < 3:
        raise ValidationError("Each class needs at least 3 samples.")

    X = df.drop(columns=[label_col]).apply(pd.to_numeric, errors="coerce")
    X = X.dropna(axis=1, how="all")  # drops text columns such as sample IDs
    if X.shape[1] < 2:
        raise ValidationError("Need at least 2 numeric gene columns.")

    # 2. Clean & normalize
    X = X.fillna(X.median())
    log_done = False
    if X.min().min() >= 0 and X.max().max() > 50:  # looks like raw counts
        X = np.log2(X + 1)
        log_done = True
    X = X.loc[:, X.std() > 0]
    if X.shape[1] < 2:
        raise ValidationError("Fewer than 2 genes have non-zero variance.")
    Z = (X - X.mean()) / X.std()

    # 3. Differential expression (Welch t-test + BH FDR)
    a, b = X[y == classes[0]], X[y == classes[1]]
    _, p = stats.ttest_ind(b, a, equal_var=False)
    p = np.nan_to_num(np.asarray(p, dtype=float), nan=1.0)
    fc = (b.mean() - a.mean()).values  # log2 fold change (class2 vs class1)
    fdr = _bh(p)
    genes = list(X.columns)
    order = np.argsort(p)
    top_de = [
        {"gene": str(genes[i]), "log2fc": round(float(fc[i]), 3),
         "pvalue": float(p[i]), "fdr": float(fdr[i])}
        for i in order[:10]
    ]
    volcano = [
        {"gene": str(genes[i]), "log2fc": round(float(fc[i]), 3),
         "nlogp": round(float(-np.log10(max(p[i], 1e-300))), 3)}
        for i in order[:3000]
    ]
    n_sig = int(((fdr < 0.05) & (np.abs(fc) >= 1)).sum())

    # 4. ML classification (Random Forest, cross-validated)
    rf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    k = int(min(5, counts.min()))
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    proba = cross_val_predict(rf, Z.values, y, cv=skf, method="predict_proba")
    pred = np.array(classes)[proba.argmax(axis=1)]
    accuracy = float((pred == y).mean())
    rf.fit(Z.values, y)
    imp_idx = np.argsort(rf.feature_importances_)[::-1][:10]
    top_importance = [{"gene": str(genes[i]), "importance": round(float(rf.feature_importances_[i]), 4)}
                      for i in imp_idx]

    # 5. PCA for visualization
    pcs = PCA(n_components=2, random_state=42).fit_transform(Z.values)
    pca = [{"pc1": round(float(pcs[i, 0]), 3), "pc2": round(float(pcs[i, 1]), 3), "label": str(y[i])}
           for i in range(len(y))]

    predictions = [
        {"sample": i + 1, "actual": str(y[i]), "predicted": str(pred[i]),
         "confidence": round(float(proba[i].max()), 3)}
        for i in range(len(y))
    ]

    # 6. Extra visualisation data
    hm_genes = [genes[i] for i in order[:15]]
    idx = np.argsort(y, kind="stable")  # group samples by class
    if len(idx) > 80:
        idx = idx[np.linspace(0, len(idx) - 1, 80).astype(int)]
    hm_vals = np.clip(Z[hm_genes].values[idx], -3, 3).round(2).tolist()
    heatmap = {"genes": [str(g) for g in hm_genes],
               "samples": [{"id": f"S{int(i) + 1}", "label": str(y[i])} for i in idx],
               "values": hm_vals}
    confusion = {"labels": classes,
                 "matrix": [[int(((y == r) & (pred == c)).sum()) for c in classes] for r in classes]}
    hist_counts, _ = np.histogram(proba.max(axis=1), bins=[0.5, 0.6, 0.7, 0.8, 0.9, 1.01])
    confidence_hist = [{"range": r, "count": int(n)}
                       for r, n in zip(["50-60%", "60-70%", "70-80%", "80-90%", "90-100%"], hist_counts)]
    mean_expression = []
    for i in order[:8]:
        g = genes[i]
        mean_expression.append({"gene": str(g), classes[0]: round(float(a[g].mean()), 2),
                                classes[1]: round(float(b[g].mean()), 2)})

    return {
        "summary": {"samples": int(len(y)), "genes": int(X.shape[1]), "classes": classes,
                    "class_counts": {c: int(counts[c]) for c in classes},
                    "log2_transformed": log_done, "cv_folds": k,
                    "cv_accuracy": round(accuracy, 4), "significant_genes": n_sig},
        "top_de_genes": top_de, "top_importance": top_importance,
        "volcano": volcano, "pca": pca, "predictions": predictions,
        "heatmap": heatmap, "confusion": confusion,
        "confidence_hist": confidence_hist, "mean_expression": mean_expression,
    }
