"""Fine-tune ResNet18 on EuroSAT (downloads ~90 MB the first time).
Run:  python train_eurosat.py      -> creates satellite_model.pth
CPU-friendly: uses 8000 images x 3 epochs (~5-15 min on a laptop CPU).
"""
import torch
import torch.nn as nn
import torchvision
from torch.utils.data import DataLoader, random_split
from torchvision import transforms as T

from satellite_module import CLASSES, MEAN, STD, WEIGHTS

torch.manual_seed(42)
N_TRAIN, N_VAL, EPOCHS = 8000, 2000, 3

tf = T.Compose([T.ToTensor(), T.Normalize(MEAN, STD)])
ds = torchvision.datasets.EuroSAT(root="data", download=True, transform=tf)
assert ds.classes == CLASSES, ds.classes
rest = len(ds) - N_TRAIN - N_VAL
train_ds, val_ds, _ = random_split(ds, [N_TRAIN, N_VAL, rest],
                                   generator=torch.Generator().manual_seed(42))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)
val_dl = DataLoader(val_ds, batch_size=128)

model = torchvision.models.resnet18(weights=torchvision.models.ResNet18_Weights.IMAGENET1K_V1)
model.fc = nn.Linear(model.fc.in_features, len(CLASSES))
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(EPOCHS):
    model.train()
    for i, (x, y) in enumerate(train_dl):
        opt.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        opt.step()
        if i % 20 == 0:
            print(f"epoch {epoch + 1}/{EPOCHS} batch {i}/{len(train_dl)} loss {loss.item():.3f}")
    model.eval()
    correct = 0
    with torch.no_grad():
        for x, y in val_dl:
            correct += (model(x).argmax(1) == y).sum().item()
    print(f"==> epoch {epoch + 1} validation accuracy: {correct / N_VAL:.3f}")

torch.save(model.state_dict(), WEIGHTS)
print("Saved", WEIGHTS)
