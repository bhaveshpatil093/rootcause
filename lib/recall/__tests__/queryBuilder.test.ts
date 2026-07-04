import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askRootCause } from '../queryBuilder';
import { cognee } from '../../ingestion/cogneeClient';

// Mock the cognee client methods
vi.mock('../../ingestion/cogneeClient', () => ({
  cognee: {
    datasets: {
      list: vi.fn(),
    },
    recall: vi.fn(),
    search: vi.fn(),
  },
  withRetry: vi.fn((fn) => fn()),
}));

describe('askRootCause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if the provided datasetNames do not match any existing datasets (no silent fallback)', async () => {
    (cognee.datasets.list as import('vitest').Mock).mockResolvedValue([
      { id: '1', name: 'some-other-dataset' }
    ]);

    await expect(askRootCause('Where is the bug?', { datasetNames: ['missing-repo-data'] }))
      .rejects
      .toThrow('No matching dataset found for this repo — try re-ingesting');
      
    expect(cognee.search).not.toHaveBeenCalled();
    expect(cognee.recall).not.toHaveBeenCalled();
  });

  it('runs search scoped to datasetIds if datasetNames match successfully', async () => {
    (cognee.datasets.list as import('vitest').Mock).mockResolvedValue([
      { id: 'id-123', name: 'demo-dataset' }
    ]);
    (cognee.search as import('vitest').Mock).mockResolvedValue({ result: { kind: 'Text', data: 'Found it' } });

    const result = await askRootCause('Where is the bug?', { datasetNames: ['demo-dataset'] });
    
    expect(cognee.search).toHaveBeenCalledWith('Where is the bug?', {
      topK: 10,
      datasetIds: ['id-123']
    });
    expect(result).toEqual({ result: { kind: 'Text', data: 'Found it' } });
  });

  it('runs unscoped recall if datasetNames is not provided at all', async () => {
    (cognee.recall as import('vitest').Mock).mockResolvedValue({ searchResponse: { result: { kind: 'Text', data: 'Found it globally' } } });

    const result = await askRootCause('Where is the bug?');
    
    expect(cognee.recall).toHaveBeenCalledWith('Where is the bug?', { topK: 10 });
    expect(cognee.search).not.toHaveBeenCalled();
    expect(cognee.datasets.list).not.toHaveBeenCalled();
    
    expect(result).toEqual({ result: { kind: 'Text', data: 'Found it globally' } });
  });
});
