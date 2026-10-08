"""Research Toolkit: Dataset Explorer. Upload any CSV -> statistics + chart data."""
import io
import json
import numpy as np
import pandas as pd


class ValidationError(ValueError):
    pass


def _num(x):
    return None if pd.isna(x) else round(float(x), 4)


def analyze(file_bytes: bytes) -> dict:
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception:
        raise ValidationError("File is not a readable CSV.")
    if df.shape[0] < 2 or df.shape[1] < 1:
        raise ValidationError("CSV needs at least 2 rows and 1 column.")
    df = df.head(200_000)
    num = df.select_dtypes(include="number")
    if num.shape[1] == 0:
        raise ValidationError("No numeric columns found in this CSV.")

    columns = [{"name": str(c), "type": "numeric" if c in num.columns else "text",
                "missing": int(df[c].isna().sum()), "unique": int(df[c].nunique())} for c in df.columns]
    stats = [{"column": str(c), "mean": _num(num[c].mean()), "std": _num(num[c].std()),
              "min": _num(num[c].min()), "median": _num(num[c].median()), "max": _num(num[c].max())}
             for c in num.columns]

    histograms = []
    for c in list(num.columns)[:12]:
        v = num[c].dropna()
        if v.empty:
            continue
        counts, edges = np.histogram(v, bins=12)
        histograms.append({"column": str(c), "bins": [
            {"bin": f"{edges[i]:.3g}", "count": int(counts[i])} for i in range(len(counts))]})

    cols = list(num.columns)[:10]
    corr = num[cols].corr().fillna(0).round(2)
    correlation = {"columns": [str(c) for c in cols], "matrix": corr.values.tolist()}

    categories = []
    for c in df.columns:
        if c not in num.columns and df[c].nunique() <= 15:
            vc = df[c].value_counts()
            categories.append({"column": str(c),
                               "counts": [{"name": str(k), "count": int(v)} for k, v in vc.items()]})
        if len(categories) >= 3:
            break

    missing = [{"column": x["name"], "missing": x["missing"]} for x in columns if x["missing"] > 0]
    return {
        "summary": {"rows": int(df.shape[0]), "columns": int(df.shape[1]),
                    "numeric_columns": int(num.shape[1]), "missing_cells": int(df.isna().sum().sum())},
        "columns": columns, "stats": stats, "histograms": histograms, "correlation": correlation,
        "categories": categories, "missing": missing,
        "preview": json.loads(df.head(5).to_json(orient="records")),
    }
