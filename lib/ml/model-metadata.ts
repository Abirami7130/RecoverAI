import fs from 'fs';
import path from 'path';

export interface ModelMetadataFile {
  model_version?: string;
  model_type?: string;
  dataset?: string;
  training_rows?: number;
  row_count?: number;
  roc_auc_test?: number;
  average_precision_test?: number;
  brier_score_test?: number;
  calibration?: string;
  split?: {
    test_size?: number;
    random_state?: number;
    stratify?: boolean;
  };
  generatedAt?: string;
}

const METADATA_PATH = path.join(
  process.cwd(),
  'ml',
  'models',
  'model_metadata.json'
);

export function readModelMetadata(): ModelMetadataFile | null {
  try {
    const raw = fs.readFileSync(METADATA_PATH, 'utf8');
    return JSON.parse(raw) as ModelMetadataFile;
  } catch {
    return null;
  }
}

export function modelMetadataForApi() {
  const file = readModelMetadata();
  if (!file) {
    return null;
  }

  const rowCount = file.row_count ?? file.training_rows ?? null;

  return {
    version: file.model_version ?? 'gb-2026-10-30-synthetic',
    dataset: file.dataset ?? 'synthetic_v1',
    modelType: file.model_type ?? null,
    rowCount,
    rocAuc: file.roc_auc_test ?? null,
    averagePrecision: file.average_precision_test ?? null,
    brier: file.brier_score_test ?? null,
    calibration: file.calibration ?? null,
    split: file.split ?? null,
    generatedAt: file.generatedAt ?? null,
  };
}

export const MODEL_METADATA_DISCLAIMER =
  'Failure probabilities come from a gradient boosting model trained on 50,000 synthetic payments. They are not a measured live recovery rate.';
