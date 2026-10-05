import { GatewayProcessResult } from '../../../src/gateway/gateway';
import { AttackSimulator } from '../../../src/attacker/simulator';
import { CommandEnvelope } from '../../../src/models/command';
import { CommandService } from './commandService';
import { MissionService } from './missionService';
import { SecurityEventRepository } from '../db/repositories/securityEventRepository';
import { config } from '../config';

export type AttackScenarioName =
  | 'TAMPERING'
  | 'INJECTION'
  | 'REPLAY'
  | 'CREDENTIAL_COMPROMISE'
  | 'DESTRUCTIVE_BURN'
  | 'EAVESDROP';

export const ATTACK_SCENARIO_NAMES: AttackScenarioName[] = [
  'TAMPERING',
  'INJECTION',
  'REPLAY',
  'CREDENTIAL_COMPROMISE',
  'DESTRUCTIVE_BURN',
  'EAVESDROP'
];

/**
 * Controlled LOCAL attack simulation (hackathon demo — not offensive tooling).
 *
 * Hostile envelopes are manufactured inside the backend process, so the browser
 * never needs credential material. Each scenario is controlled simulation
 * metadata + a mutated/legitimate envelope run through the unchanged gateway
 * pipeline, tagged with its `simulated_attack_type` for the audit trail.
 */
export class AttackService {
  private readonly attacker: AttackSimulator;
  private readonly eventRepository = new SecurityEventRepository();

  constructor(
    private readonly commandService: CommandService,
    private readonly missionService: MissionService,
    private readonly spacecraftId = config.defaultSpacecraftId
  ) {
    // Share the per-key synced originator so attacker + operator traffic form
    // one monotonic per-sender sequence stream (no accidental replay collisions).
    this.attacker = new AttackSimulator(this.commandService.getOperatorClient('GS-PRIMARY-01'));
  }

  public async runScenario(scenario: AttackScenarioName): Promise<{
    scenario: AttackScenarioName;
    description: string;
    result: GatewayProcessResult;
  }> {
    switch (scenario) {
      case 'TAMPERING':
        return this.run('TAMPERING', () => this.attacker.generateTamperedCommand());

      case 'INJECTION':
        return this.run('INJECTION', () => this.attacker.generateUnauthorizedInjection());

      case 'REPLAY':
        return this.runReplay();

      case 'CREDENTIAL_COMPROMISE':
        // The attacker times the intrusion for the eclipse window (umbra),
        // where imaging is prohibited by mission flight rule OPT-02.
        this.missionService.setPhase('UMBRA_ECLIPSE');
        return this.run('CREDENTIAL_COMPROMISE', () => this.attacker.generateCredentialCompromiseCommand());

      case 'DESTRUCTIVE_BURN':
        this.missionService.setPhase('UMBRA_ECLIPSE');
        return this.run('DESTRUCTIVE_BURN', () => this.attacker.generateDestructiveThrusterWithValidCreds());

      case 'EAVESDROP': {
        // Passive interception demo: originate a legitimately signed command
        // whose sensitive parameters exist ONLY as AES-GCM ciphertext on the
        // wire. The gateway authenticates and decrypts server-side.
        const result = await this.commandService.processOperatorCommand(
          {
            key_id: 'GS-PRIMARY-01',
            command_type: 'CAPTURE_IMAGE',
            parameters: {
              target: 'Restricted Ground Target',
              secret_coordinate_lat: 48.8566,
              secret_coordinate_lon: 2.3522,
              resolution: '4096x3072 Multispectral'
            },
            encrypt: true
          },
          { attackType: 'EAVESDROP' }
        );
        return {
          scenario,
          description:
            'Ciphertext analysis: an encrypted uplink command was captured; payload parameters travel only as AES-GCM-256 ciphertext and are decrypted exclusively inside the security gateway.',
          result
        };
      }

      default:
        throw new TypeError(`Unknown attack scenario: ${scenario as string}`);
    }
  }

  private async run(
    scenario: AttackScenarioName,
    generate: () => Promise<{ envelope: CommandEnvelope; description: string }>
  ): Promise<{ scenario: AttackScenarioName; description: string; result: GatewayProcessResult }> {
    const { envelope, description } = await generate();
    const result = await this.commandService.processCommand(envelope, { attackType: scenario });
    return { scenario, description, result };
  }

  /**
   * Replay simulation needs a previously captured transmission. Use the most
   * recent accepted envelope from the audit trail; if the trail is empty,
   * originate one legitimate command first (the "capture"), then replay it.
   */
  private async runReplay(): Promise<{
    scenario: AttackScenarioName;
    description: string;
    result: GatewayProcessResult;
  }> {
    let captured = this.eventRepository.getLatestAcceptedEnvelope();
    if (!captured) {
      await this.commandService.processOperatorCommand({
        key_id: 'GS-PRIMARY-01',
        command_type: 'ROTATE_REACTION_WHEEL',
        parameters: { axis: 1, rpm: 2200 }
      });
      captured = this.eventRepository.getLatestAcceptedEnvelope();
    }
    if (!captured) {
      throw new Error('Replay scenario requires at least one previously accepted command envelope');
    }
    const { description } = await this.attacker.generateReplayCommand(captured);
    const result = await this.commandService.processCommand(captured, { attackType: 'REPLAY' });
    return { scenario: 'REPLAY', description, result };
  }
}
