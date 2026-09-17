import { randomUUID } from 'node:crypto';
import type { Handover, Report, ReviewVoid, Sanction } from './types.js';

/** In-memory moderation store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export class ModerationStore {
  private reports = new Map<string, Report>();
  private sanctions: Sanction[] = [];
  private voids: ReviewVoid[] = [];
  private handovers: Handover[] = [];
  /** Report ids currently Under review (= open cases for purpose-bound reads, P-4). */
  private openCases = new Set<string>();

  insertReport(r: Omit<Report, 'id'>): Report {
    const full: Report = { ...r, id: randomUUID() };
    this.reports.set(full.id, full);
    return structuredClone(full);
  }

  getReport(id: string): Report | undefined {
    const r = this.reports.get(id);
    return r ? structuredClone(r) : undefined;
  }

  saveReport(r: Report): void {
    this.reports.set(r.id, structuredClone(r));
  }

  addSanction(s: Omit<Sanction, 'id'>): Sanction {
    const full: Sanction = { ...s, id: randomUUID() };
    this.sanctions.push(full);
    return { ...full };
  }

  addVoid(v: Omit<ReviewVoid, 'id'>): ReviewVoid {
    const full: ReviewVoid = { ...v, id: randomUUID() };
    this.voids.push(full);
    return { ...full };
  }

  addHandover(h: Omit<Handover, 'id'>): Handover {
    const full: Handover = { ...h, id: randomUUID() };
    this.handovers.push(full);
    return structuredClone(full);
  }

  getSanctions(): Sanction[] {
    return this.sanctions.map((s) => ({ ...s }));
  }

  getVoids(): ReviewVoid[] {
    return this.voids.map((v) => ({ ...v }));
  }

  getHandovers(): Handover[] {
    return this.handovers.map((h) => structuredClone(h));
  }

  openCase(reportId: string): void {
    this.openCases.add(reportId);
  }

  closeCase(reportId: string): void {
    this.openCases.delete(reportId);
  }

  hasOpenCase(): boolean {
    return this.openCases.size > 0;
  }

  /** Open (Under review) reports — for purpose-scoped case checks (P-4). */
  openReports(): Report[] {
    const out: Report[] = [];
    for (const r of this.reports.values()) {
      if (r.status === 'Under review') out.push(structuredClone(r));
    }
    return out;
  }
}
