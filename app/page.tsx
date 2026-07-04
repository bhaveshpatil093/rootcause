/*
 * AUDIT FINDINGS (API vs Client Expectations)
 * 
 * 1. /api/ingest current return signature:
 *    - Status 202 Accepted
 *    - JSON: { message: 'Ingestion job started', jobId: 'uuid-string' }
 *    - Data is no longer returned synchronously.
 * 
 * 2. app/page.tsx (handleIngest):
 *    - ALREADY FIXED! During a previous step, handleIngest was proactively updated 
 *      to correctly expect `{ jobId }` and a 202 status, kicking off `pollJob()`.
 *      It correctly handles the new async polling architecture.
 * 
 * 3. lib/recall/cli.ts:
 *    - MISMATCH: It does not call `/api/ingest`, but it hardcodes 
 *      `datasetNames: ["demo-auth-bug"]`. This is broken because dataset names 
 *      are now dynamically generated (e.g., `commits-[hash]-[timestamp]-batch-0`).
 *      The CLI needs to be updated to either fetch datasets dynamically or accept them as arguments.
 */
'use client';

import React, { useState } from 'react';

type Verdict = 'RESOLVED' | 'RESURFACED' | 'UNKNOWN';

interface CaseEntry {
  id: number;
  question: string;
  answer: string;
  verdict: Verdict;
  relatedCommits: string[];
}

function getVerdict(answer: string): Verdict {
  const resurfaced = /resurfac|happened before|reintroduc|regress|did not hold|didn.?t hold/i.test(answer);
  const noPriorRecord = /no indication|has not occurred before|not occurred before|not been mentioned|has not happened before/i.test(answer);

  if (resurfaced && !noPriorRecord) return 'RESURFACED';
  if (noPriorRecord) return 'RESOLVED';
  return 'UNKNOWN';
}

function extractCommits(answer: string): string[] {
  const matches = answer.match(/commit\s+([a-z0-9]{6,8})/gi) || [];
  const hashes = matches.map((m) => m.replace(/commit\s+/i, ''));
  return Array.from(new Set(hashes));
}

const VERDICT_STYLES: Record<Verdict, { label: string; color: string; border: string; bg: string }> = {
  RESOLVED: {
    label: 'RESOLVED',
    color: 'var(--amber)',
    border: 'border-[var(--amber)]',
    bg: 'bg-[var(--amber)]/10',
  },
  RESURFACED: {
    label: 'RESURFACED — UNRESOLVED',
    color: 'var(--red)',
    border: 'border-[var(--red)]',
    bg: 'bg-[var(--red)]/10',
  },
  UNKNOWN: {
    label: 'NO PRIOR RECORD',
    color: 'var(--muted)',
    border: 'border-[var(--muted)]',
    bg: 'bg-[var(--muted)]/10',
  },
};

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<CaseEntry[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] = useState<{ progress: number; total: number; message: string } | null>(null);
  const [activeDatasets, setActiveDatasets] = useState<string[]>([]);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim() || ingesting) return;

    setIngesting(true);
    setIngestStatus(null);
    setIngestProgress(null);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: repoUrl.trim() }),
      });
      const data = await res.json();

      if (res.status === 202 && data.jobId) {
        pollJob(data.jobId);
      } else {
        setIngestStatus(`Error: ${data.error || 'ingestion failed'}`);
        setIngesting(false);
      }
    } catch (err) {
      setIngestStatus('Error: could not reach the ingestion service.');
      setIngesting(false);
    }
  }

  function pollJob(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ingest/status/${jobId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        const job = await res.json();

        if (job.status === 'completed') {
          clearInterval(interval);
          setIngesting(false);
          
          if (job.stats) {
            setIngestStatus(`Case opened! ${job.stats.totalCommits} commits, ${job.stats.fixCommitsDetected} fixes, ${job.stats.functionsMapped} functions mapped.`);
          } else {
            setIngestStatus(`Case opened — ${job.total} commits added to the graph.`);
          }
          
          setIngestProgress(null);
          setActiveDatasets(job.datasetNames || []);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setIngesting(false);
          setIngestStatus(`Error: ${job.error || job.message}`);
          setIngestProgress(null);
        } else {
          setIngestProgress({
            progress: job.progress || 0,
            total: job.total || 0,
            message: job.message
          });
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000);
  }

  const activeCase = cases.find((c) => c.id === activeId) || null;

  async function handleInvestigate(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    const askedQuestion = question.trim();
    setQuestion('');

    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: askedQuestion, datasetNames: activeDatasets }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || 'No answer returned.';

      const entry: CaseEntry = {
        id: Date.now(),
        question: askedQuestion,
        answer,
        verdict: getVerdict(answer),
        relatedCommits: extractCommits(answer),
      };

      setCases((prev) => [entry, ...prev]);
      setActiveId(entry.id);
    } catch (err) {
      const entry: CaseEntry = {
        id: Date.now(),
        question: askedQuestion,
        answer: 'Investigation failed — could not reach the memory graph.',
        verdict: 'UNKNOWN',
        relatedCommits: [],
      };
      setCases((prev) => [entry, ...prev]);
      setActiveId(entry.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Top bar */}
      <header className="border-b border-[var(--panel-border)] px-8 py-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="font-mono text-lg tracking-[0.2em] text-[var(--text)]">
              ROOT<span style={{ color: 'var(--amber)' }}>CAUSE</span>
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Debugging is just déjà vu without the memory...
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            {cases.length} {cases.length === 1 ? 'case' : 'cases'} logged
          </span>
        </div>

        <form onSubmit={handleIngest} className="flex gap-3 items-center">
          <span className="font-mono text-xs tracking-widest text-[var(--muted)] whitespace-nowrap">
            OPEN CASE FILE
          </span>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-[var(--panel)] border border-[var(--panel-border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--amber)]"
          />
          <button
            type="submit"
            disabled={ingesting || !repoUrl.trim()}
            className="font-mono text-xs tracking-widest uppercase px-4 py-2 rounded border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {ingesting ? 'Analyzing…' : 'Analyze Repository'}
          </button>
        </form>

        {ingestProgress && (
          <div className="mt-4 flex flex-col gap-1 max-w-md">
            <div className="flex justify-between text-xs font-mono text-[var(--muted)]">
              <span>{ingestProgress.message}</span>
              {ingestProgress.total > 0 && (
                <span>{ingestProgress.progress} / {ingestProgress.total}</span>
              )}
            </div>
            {ingestProgress.total > 0 && (
              <div className="w-full bg-[var(--panel)] border border-[var(--panel-border)] rounded-full h-2 mt-1 overflow-hidden">
                <div 
                  className="bg-[var(--amber)] h-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, (ingestProgress.progress / ingestProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {ingestStatus && !ingestProgress && (
          <p className="font-mono text-xs mt-2 text-[var(--muted)]">{ingestStatus}</p>
        )}
      </header>

      <div className="grid grid-cols-12 flex-1">
        {/* Left: question log */}
        <aside className="col-span-3 border-r border-[var(--panel-border)] p-5 overflow-y-auto">
          <h2 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-4">
            QUESTION LOG
          </h2>
          {cases.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              No investigations yet. Ask a question to open a case.
            </p>
          )}
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                    activeId === c.id
                      ? 'border-[var(--amber)] bg-[var(--panel)]'
                      : 'border-[var(--panel-border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                    style={{ background: VERDICT_STYLES[c.verdict].color }}
                  />
                  <span className="text-[var(--text)]">
                    {c.question.length > 60 ? c.question.slice(0, 60) + '…' : c.question}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center: case file */}
        <main className="col-span-6 border-r border-[var(--panel-border)] p-6 flex flex-col">
          <h2 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-4">
            CASE FILE — QUERY
          </h2>

          <form onSubmit={handleInvestigate} className="mb-6">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. why did the auth token bug happen, and has it happened before?"
              rows={3}
              className="w-full bg-[var(--panel)] border border-[var(--panel-border)] rounded px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--amber)] resize-none"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="mt-3 font-mono text-xs tracking-widest uppercase px-5 py-2.5 rounded border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Investigating…' : 'Investigate'}
            </button>
          </form>

          <div className="flex-1">
            {loading && (
              <div className="font-mono text-sm text-[var(--muted)] space-y-1">
                <p>&gt; Parsing query</p>
                <p>&gt; Traversing knowledge graph</p>
                <p>&gt; Synthesizing answer…</p>
              </div>
            )}

            {!loading && activeCase && (
              <div>
                <h3 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-2">
                  ANALYSIS
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text)] bg-[var(--panel)] border border-[var(--panel-border)] rounded px-4 py-4">
                  {activeCase.answer}
                </p>
              </div>
            )}

            {!loading && !activeCase && cases.length === 0 && (
              <p className="text-sm text-[var(--muted)] italic">
                Open a case by asking a question above.
              </p>
            )}
          </div>
        </main>

        {/* Right: verdict + related commits */}
        <aside className="col-span-3 p-5 space-y-6">
          <div>
            <h2 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-3">
              INVESTIGATION VERDICT
            </h2>
            {activeCase ? (
              <div
                className={`border-2 ${VERDICT_STYLES[activeCase.verdict].border} ${VERDICT_STYLES[activeCase.verdict].bg} rounded px-4 py-3 -rotate-1`}
              >
                <span
                  className="font-mono text-sm tracking-wider font-semibold"
                  style={{ color: VERDICT_STYLES[activeCase.verdict].color }}
                >
                  {VERDICT_STYLES[activeCase.verdict].label}
                </span>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No case selected.</p>
            )}
          </div>

          <div>
            <h2 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-3">
              RELATED COMMITS
            </h2>
            {activeCase && activeCase.relatedCommits.length > 0 ? (
              <ul className="space-y-2">
                {activeCase.relatedCommits.map((hash) => (
                  <li
                    key={hash}
                    className="font-mono text-xs px-3 py-2 rounded border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--text)]"
                  >
                    {hash}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No commits cited.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}