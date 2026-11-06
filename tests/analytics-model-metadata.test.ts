import { describe, it, expect } from 'vitest';
import { modelMetadataForApi, readModelMetadata } from '@/lib/ml/model-metadata';

describe('model metadata for analytics', () => {
  it('reads ROC AUC from model_metadata.json for display', () => {
    const file = readModelMetadata();
    expect(file).not.toBeNull();
    expect(file?.roc_auc_test).toBe(0.7897);

    const api = modelMetadataForApi();
    expect(api?.rocAuc).toBe(0.7897);
    expect(api?.dataset).toBeTruthy();
  });
});
