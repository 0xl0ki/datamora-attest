#!/usr/bin/env python3
"""Export datamora-entry-score-v1 to ONNX for the EZKL upgrade path.

Needs torch + onnx (run in Linux/Docker, same as EZKL):
    pip install torch onnx && python3 export_model.py
"""
import torch
import torch.nn as nn


class EntryScore(nn.Module):
    # weights [bias, w_momentum, w_liquidity, w_age] — identical to lib/inference.mjs
    def __init__(self):
        super().__init__()
        self.w = nn.Parameter(torch.tensor([0.0, 2.5, 0.8, -0.05], dtype=torch.float32))

    def forward(self, x):  # x: [batch, 3] = [momentum, liquidityUsd, ageMinutes]
        momentum, liquidity, age = x[:, 0], x[:, 1], x[:, 2]
        z = self.w[0] + self.w[1] * momentum + self.w[2] * torch.log1p(liquidity / 1e3) + self.w[3] * (age / 100)
        return torch.sigmoid(z).unsqueeze(1)


if __name__ == "__main__":
    model = EntryScore().eval()
    dummy = torch.tensor([[0.12, 18400.0, 45.0]])
    torch.onnx.export(model, dummy, "model.onnx", input_names=["input"], output_names=["score"], opset_version=18)
    # sanity: should be ~0.93
    print("exported model.onnx; output for sample =", model(dummy).item())
