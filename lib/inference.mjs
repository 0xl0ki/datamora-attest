// Verifiable inference (S5 — decision-input authenticity).
//
// Closes the "agent self-reports its decision" gap for the numeric model
// output: a public, deterministic model is committed by `modelHash`, the
// receipt carries (input, output), and anyone recomputes
//   output === runModel(input)  &&  inferenceHash === digest({modelHash, input, output})
//
// This is "verifiable inference" (not zero-knowledge): the model is public and
// the input is visible. The upgrade path to succinct zero-knowledge proofs is
// the same model exported to ONNX + EZKL (see verify/zkml/).
import { digest } from './canonical.mjs';

// Public 3-feature logistic "entry score" model (fixed weights).
// score = sigmoid( bias + wMom*momentum + wLiq*log1p(liquidityUsd/1e3) + wAge*ageMinutes/100 )
export const MODEL = Object.freeze({
  name: 'datamora-entry-score-v1',
  version: 1,
  weights: [0.0, 2.5, 0.8, -0.05],
});

export function modelHash() {
  return digest({ name: MODEL.name, version: MODEL.version, weights: MODEL.weights });
}

export function runModel(input) {
  const momentum = Number(input?.momentum ?? 0);
  const liquidityUsd = Math.max(0, Number(input?.liquidityUsd ?? 0));
  const ageMinutes = Math.max(0, Number(input?.ageMinutes ?? 0));
  const [bias, wMom, wLiq, wAge] = MODEL.weights;
  const z = bias + wMom * momentum + wLiq * Math.log1p(liquidityUsd / 1e3) + wAge * (ageMinutes / 100);
  return Number((1 / (1 + Math.exp(-z))).toFixed(8));
}

export function sealInference(input) {
  const mh = modelHash();
  const output = runModel(input);
  return {
    model: MODEL.name,
    modelHash: mh,
    input,
    output,
    inferenceHash: digest({ modelHash: mh, input, output }),
  };
}

export function verifyInference(inference) {
  const errors = [];
  if (!inference || typeof inference !== 'object') return { ok: false, errors: ['inference_missing'] };
  if (inference.model !== MODEL.name) errors.push('inference_model_mismatch');
  if (inference.modelHash !== modelHash()) errors.push('inference_model_hash_mismatch');
  if (runModel(inference.input) !== inference.output) errors.push('inference_output_mismatch');
  const recomputed = digest({ modelHash: inference.modelHash, input: inference.input, output: inference.output });
  if (recomputed !== inference.inferenceHash) errors.push('inference_hash_mismatch');
  return { ok: errors.length === 0, errors };
}
