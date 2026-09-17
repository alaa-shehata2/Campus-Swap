export interface PilotMetrics {
  members: number;
  activeMembers: number;
  moderators: number;
  listings: number;
  activeListings: number;
  /** Owner-published and not removed: Active + Paused (D12 "published listings"). */
  publishedListings: number;
  completedExchanges: number;
  reportsReceived: number;
  reportsUnderReview: number;
  reportsResolved: number;
  /** Median Received → Resolved latency in ms; null when nothing resolved yet. */
  medianTriageMs: number | null;
  sanctions: number;
  handovers: number;
  safetyIncidents: number;
  reviewsPublished: number;
  generatedAtMs: number;
}

export interface TargetProgress {
  met: boolean;
  actual: number;
  target: number;
  remaining: number;
}

export interface PilotProgress {
  members: TargetProgress;
  listings: TargetProgress;
  completions: TargetProgress;
  triage: TargetProgress;
}
