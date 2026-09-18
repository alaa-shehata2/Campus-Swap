'use client';

import { useMemo, useState } from 'react';
import { evaluateLaunchGate, type LaunchAttestations } from '../../src/launch/gate.js';
import type { HealthReport } from '../../src/launch/health.js';
import type { PilotMetrics } from '../../src/metrics/types.js';
import { Badge } from './ui/Badge';

const ATTESTATIONS: Array<{ key: keyof LaunchAttestations; label: string }> = [
  { key: 'termsSignedOff', label: 'Terms, privacy notice, and disclaimers signed off' },
  { key: 'consultRecorded', label: 'KFS student-affairs consultation recorded' },
  { key: 'backupDemonstrated', label: 'Backup and restore demonstrated' },
  { key: 'securityDrill', label: 'SECURITY contact and triage drill verified' },
  { key: 'keyboardPass', label: 'Keyboard-only J0–J6 and report pass completed' },
  { key: 'disclaimerManualPass', label: 'Disclaimer contrast and screen-reader review passed' },
];

export function GateChecker({
  metrics,
  health,
  moderatorCount,
}: {
  metrics: PilotMetrics;
  health: HealthReport;
  moderatorCount: number;
}) {
  const [attestations, setAttestations] = useState<LaunchAttestations>({
    termsSignedOff: false,
    consultRecorded: false,
    backupDemonstrated: false,
    securityDrill: false,
    keyboardPass: false,
    disclaimerManualPass: false,
  });
  const result = useMemo(
    () =>
      evaluateLaunchGate({
        metrics,
        health,
        moderatorCount,
        attestations,
      }),
    [metrics, health, moderatorCount, attestations],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={result.pass ? 'active' : 'warning'}>{result.pass ? 'Launch gate passed' : 'Launch gate blocked'}</Badge>
        <span className="text-sm text-text-muted">
          {moderatorCount} of 2 required moderators
        </span>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Human attestations</legend>
        {ATTESTATIONS.map(({ key, label }) => (
          <label key={key} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={attestations[key]}
              onChange={(event) =>
                setAttestations((current) => ({ ...current, [key]: event.target.checked }))
              }
              className="mt-1 size-4 accent-brand"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {!result.pass && (
        <div role="alert" className="rounded-md border border-status-warning bg-surface-sunken p-3 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {result.failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
