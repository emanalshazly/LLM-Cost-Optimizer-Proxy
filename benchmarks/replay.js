import { readFile } from 'node:fs/promises';
import { calculateSavings, PRICING_PROVENANCE } from '../src/config/pricing.js';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('usage: node benchmarks/replay.js <fixture.json>');

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
  throw new Error('fixture must contain a non-empty cases array');
}

const results = fixture.cases.map((item) => {
  const cost = calculateSavings(item.original_model, item.used_model, item.tokens);
  return {
    id: item.id,
    cost_estimate: {
      ...cost,
      currency: 'USD',
      pricing_status: PRICING_PROVENANCE.status,
      pricing_snapshot_checked_at: PRICING_PROVENANCE.snapshotCheckedAt,
      sources: PRICING_PROVENANCE.sources
    },
    quality_result: item.quality ?? {
      status: 'not_measured',
      result: null,
      evaluator: null
    }
  };
});

console.log(JSON.stringify({ fixture_version: fixture.fixture_version, results }, null, 2));
