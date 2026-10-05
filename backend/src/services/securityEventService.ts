import { AuditEvent } from '../../../src/models/audit';
import { SecurityEventRepository } from '../db/repositories/securityEventRepository';

/**
 * Read-side service over the persisted audit trail. Writes happen inside the
 * command processing flow (commandService) so that a decision and its audit
 * record are stored atomically with the response.
 */
export class SecurityEventService {
  private readonly repository = new SecurityEventRepository();

  public listEvents(query: { limit?: number; decision?: string; spacecraftId?: string; attackType?: string } = {}): AuditEvent[] {
    return this.repository.list(query);
  }

  public getEvent(eventId: string): AuditEvent | null {
    return this.repository.getById(eventId);
  }

  public getRecentForRehydration(limit = 50) {
    return this.repository.getRecentForRehydration(limit);
  }

  public count(): number {
    return this.repository.count();
  }

  public countsByDecision(): Record<string, number> {
    return this.repository.countsByDecision();
  }
}
