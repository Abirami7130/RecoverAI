/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RevenueFigures from '@/components/metrics/RevenueFigures';
import { createInitialAccounting } from '@/lib/recovery/accounting';

describe('RevenueFigures', () => {
  it('shows Illustrative and Verified labels', () => {
    render(
      <RevenueFigures
        accounting={createInitialAccounting()}
        formatLakhs={(v) => (v / 100000).toFixed(2)}
      />
    );

    expect(screen.getByText('Illustrative sample')).toBeTruthy();
    expect(screen.getByText('Verified captures')).toBeTruthy();
    expect(screen.getByText('Simulated this session')).toBeTruthy();
  });
});
