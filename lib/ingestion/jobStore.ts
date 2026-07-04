export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IngestionJob {
  id: string;
  status: JobStatus;
  message: string;
  progress: number;
  total: number;
  datasetNames: string[];
  repoUrl: string;
  error?: string;
  dryRunData?: any;
}

// In-memory global store to survive API route instantiations (though it may wipe on dev hot-reload)
const globalStore = global as typeof global & {
  __ingestionJobs?: Map<string, IngestionJob>;
};

if (!globalStore.__ingestionJobs) {
  globalStore.__ingestionJobs = new Map();
}

export const jobStore = globalStore.__ingestionJobs;

export function createJob(id: string, repoUrl: string, total: number): IngestionJob {
  const job: IngestionJob = {
    id,
    repoUrl,
    status: 'pending',
    message: 'Initializing...',
    progress: 0,
    total,
    datasetNames: []
  };
  jobStore.set(id, job);
  return job;
}

export function updateJob(id: string, updates: Partial<IngestionJob>) {
  const job = jobStore.get(id);
  if (job) {
    Object.assign(job, updates);
  }
}

export function getJob(id: string): IngestionJob | undefined {
  return jobStore.get(id);
}
