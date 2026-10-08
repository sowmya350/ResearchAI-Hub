"""Creates the sample CSV files in ../samples (synthetic, for demo only)."""
import os
import numpy as np
import pandas as pd

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "samples")
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(42)

# ---- gene expression (cancer vs normal) ----
n, g = 60, 200
labels = np.array(["Normal"] * 30 + ["Cancer"] * 30)
base = rng.lognormal(5, 1, g)
X = np.tile(base, (n, 1)) * rng.lognormal(0, 0.3, (n, g))
f = np.ones(g)
f[:15] = rng.uniform(2, 4, 15)
f[15:25] = rng.uniform(0.25, 0.5, 10)
X[labels == "Cancer"] *= f
df = pd.DataFrame(rng.poisson(X), columns=[f"GENE{i + 1:03d}" for i in range(g)])
df.insert(0, "sample_id", [f"S{i + 1:02d}" for i in range(n)])
df["label"] = labels
df.to_csv(os.path.join(out, "sample_gene_expression.csv"), index=False)

# ---- generic dataset for the Dataset Explorer ----
m = 150
temp = rng.normal(28, 5, m)
hum = np.clip(90 - 1.2 * (temp - 20) + rng.normal(0, 6, m), 20, 100)
wind = np.abs(rng.normal(12, 5, m))
pm25 = np.clip(80 - 2.0 * wind + 0.8 * temp + rng.normal(0, 10, m), 5, None)
rain = np.clip(rng.gamma(2, 4, m) * (hum / 60), 0, None)
ds = pd.DataFrame({"region": rng.choice(["North", "South", "East", "West"], m),
                   "temperature": temp.round(1), "humidity": hum.round(1),
                   "wind_speed": wind.round(1), "pm25": pm25.round(1), "rainfall": rain.round(1)})
ds.loc[rng.choice(m, 8, replace=False), "humidity"] = np.nan
ds.loc[rng.choice(m, 5, replace=False), "pm25"] = np.nan
ds.to_csv(os.path.join(out, "sample_environment_data.csv"), index=False)
print("Wrote sample CSVs to", os.path.abspath(out))
