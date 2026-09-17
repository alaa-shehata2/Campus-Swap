import { disclaimerAudit, cairoLabelAudit } from './audits.js';
import type { HealthReport } from './health.js';
import type { PilotMetrics } from '../metrics/types.js';

/**
 * Human attestations for launch-gate items no code can verify (NFR §10):
 * Terms authorship + sign-off (Phase 0, human-developer owned), KFS
 * student-affairs consult, backup/restore drill, SECURITY contact drill,
 * keyboard-only pass, and the manual disclaimer contrast/screen-reader bar
 * (no UI exists in this repo yet — these are audited against the real UI).
 */
export interface LaunchAttestations {
  termsSignedOff: boolean;
  consultRecorded: boolean;
  backupDemonstrated: boolean;
  securityDrill: boolean;
  keyboardPass: boolean;
  disclaimerManualPass: boolean;
}

export interface LaunchGateInput {
  /** Null = metrics instrumentation not live. */
  metrics: PilotMetrics | null;
  /** Null = health check not run. */
  health: HealthReport | null;
  moderatorCount: number;
  attestations: LaunchAttestations;
}

export interface LaunchGateResult {
  pass: boolean;
  failures: string[];
}

/** Pilot readiness checklist (NFR §10 + BL-18). Fails closed: any gap blocks launch. */
export function evaluateLaunchGate(input: LaunchGateInput): LaunchGateResult {
  const failures: string[] = [];

  for (const finding of disclaimerAudit()) {
    if (!finding.ok) failures.push(`disclaimer ${finding.flow}: ${finding.issues.join('; ')}`);
  }
  const cairo = cairoLabelAudit();
  if (!cairo.ok) failures.push(`cairo labels: ${cairo.issues.join('; ')}`);

  if (!input.metrics) {
    failures.push('metrics instrumentation not live (NFR-O-1)');
  }
  if (!input.health || input.health.status !== 'ok') {
    failures.push('health check not green on every seam (NFR-A-1, §10.4)');
  }
  if (input.moderatorCount < 2) {
    failures.push(`need 2 named moderators, have ${input.moderatorCount} (D14)`);
  }

  const a = input.attestations;
  if (!a.termsSignedOff) failures.push('Terms + privacy notice + disclaimers not signed off by human developer (§10.1)');
  if (!a.consultRecorded) failures.push('KFS student-affairs consult on haram/academic wording not recorded (§10.2)');
  if (!a.backupDemonstrated) failures.push('backup/restore + health check not demonstrated (§10.4)');
  if (!a.securityDrill) failures.push('SECURITY.md contact + triage drill not exercised (§10.5)');
  if (!a.keyboardPass) failures.push('keyboard-only pass over J0–J6 + report not completed (BL-17)');
  if (!a.disclaimerManualPass) failures.push('disclaimer contrast/readability + screen-reader bar not verified (BL-15)');

  return { pass: failures.length === 0, failures };
}
