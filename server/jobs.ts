import type { Job } from '@decisionvault/shared/api';
import type { JobStage, JobStatus } from '@decisionvault/shared/enums';

export interface InternalJob extends Job {
  repoId?: number;
  target?: string;
}

export class JobManager {
  private jobs: Map<number, InternalJob> = new Map();
  private nextId = 1;

  createJob(type: string, target?: string): InternalJob {
    const id = this.nextId++;
    const job: InternalJob = {
      id,
      type,
      status: 'queued',
      stage: 'ingest',
      progress: {
        done: 0,
        total: 0,
      },
      startedAt: new Date().toISOString(),
      target,
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: number): InternalJob | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: number, patch: Partial<InternalJob>): InternalJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const updated: InternalJob = {
      ...job,
      ...patch,
      progress: patch.progress ? { ...job.progress, ...patch.progress } : job.progress,
    };
    this.jobs.set(id, updated);
    return updated;
  }

  clear(): void {
    this.jobs.clear();
    this.nextId = 1;
  }
}

export const jobManager = new JobManager();
