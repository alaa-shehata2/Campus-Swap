import { randomUUID } from 'node:crypto';
import type { Handover, Report, ReviewVoid, Sanction } from './types.js';

/** In-memory moderation store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export interface ModerationExport {
  reports: Report[];
  sanctions: Sanction[];
  voids: ReviewVoid[];
  handovers: Handover[];
  openCases: string[];
}

/** Store port — satisfied by the in-memory store and the MySQL store. */
export interface ModerationStorePort {
  insertReport(r: Omit<Report, 'id'>): Promise<Report>;
  getReport(id: string): Promise<Report | undefined>;
  allReports(): Promise<Report[]>;
  saveReport(r: Report): Promise<void>;
  addSanction(s: Omit<Sanction, 'id'>): Promise<Sanction>;
  addVoid(v: Omit<ReviewVoid, 'id'>): Promise<ReviewVoid>;
  addHandover(h: Omit<Handover, 'id'>): Promise<Handover>;
  getSanctions(): Promise<Sanction[]>;
  getVoids(): Promise<ReviewVoid[]>;
  getHandovers(): Promise<Handover[]>;
  openCase(reportId: string): Promise<void>;
  closeCase(reportId: string): Promise<void>;
  hasOpenCase(): Promise<boolean>;
  openReports(): Promise<Report[]>;
  exportState(): Promise<ModerationExport>;
  importState(state: ModerationExport): Promise<void>;
}

export class ModerationStore {
  private reports = new Map<string, Report>();
  private sanctions: Sanction[] = [];
  private voids: ReviewVoid[] = [];
  private handovers: Handover[] = [];
  /** Report ids currently Under review (= open cases for purpose-bound reads, P-4). */
  private openCases = new Set<string>();

  async insertReport(r: Omit<Report, 'id'>): Promise<Report> {
    const full: Report = { ...r, id: randomUUID() };
    this.reports.set(full.id, full);
    return structuredClone(full);
  }

  async getReport(id: string): Promise<Report | undefined> {
    const r = this.reports.get(id);
    return r ? structuredClone(r) : undefined;
  }

  /** All reports for metrics (triage latency) and audits. */
  async allReports(): Promise<Report[]> {
    return [...this.reports.values()].map((r) => structuredClone(r));
  }

  async saveReport(r: Report): Promise<void> {
    this.reports.set(r.id, structuredClone(r));
  }

  async addSanction(s: Omit<Sanction, 'id'>): Promise<Sanction> {
    const full: Sanction = { ...s, id: randomUUID() };
    this.sanctions.push(full);
    return { ...full };
  }

  async addVoid(v: Omit<ReviewVoid, 'id'>): Promise<ReviewVoid> {
    const full: ReviewVoid = { ...v, id: randomUUID() };
    this.voids.push(full);
    return { ...full };
  }

  async addHandover(h: Omit<Handover, 'id'>): Promise<Handover> {
    const full: Handover = { ...h, id: randomUUID() };
    this.handovers.push(full);
    return structuredClone(full);
  }

  async getSanctions(): Promise<Sanction[]> {
    return this.sanctions.map((s) => ({ ...s }));
  }

  async getVoids(): Promise<ReviewVoid[]> {
    return this.voids.map((v) => ({ ...v }));
  }

  async getHandovers(): Promise<Handover[]> {
    return this.handovers.map((h) => structuredClone(h));
  }

  async openCase(reportId: string): Promise<void> {
    this.openCases.add(reportId);
  }

  async closeCase(reportId: string): Promise<void> {
    this.openCases.delete(reportId);
  }

  async hasOpenCase(): Promise<boolean> {
    return this.openCases.size > 0;
  }

  /** Open (Under review) reports — for purpose-scoped case checks (P-4). */
  async openReports(): Promise<Report[]> {
    const out: Report[] = [];
    for (const r of this.reports.values()) {
      if (r.status === 'Under review') out.push(structuredClone(r));
    }
    return out;
  }

  async exportState(): Promise<ModerationExport> {
    return {
      reports: [...this.reports.values()].map((r) => structuredClone(r)),
      sanctions: await this.getSanctions(),
      voids: await this.getVoids(),
      handovers: await this.getHandovers(),
      openCases: [...this.openCases],
    };
  }

  async importState(state: ModerationExport): Promise<void> {
    if (!state || !Array.isArray(state.reports)) throw new Error('Invalid moderation snapshot.');
    this.reports.clear();
    this.sanctions = [];
    this.voids = [];
    this.handovers = [];
    this.openCases.clear();
    for (const r of state.reports) this.reports.set(r.id, structuredClone(r));
    for (const s of state.sanctions ?? []) this.sanctions.push({ ...s });
    for (const v of state.voids ?? []) this.voids.push({ ...v });
    for (const h of state.handovers ?? []) this.handovers.push(structuredClone(h));
    for (const c of state.openCases ?? []) this.openCases.add(c);
  }
}
