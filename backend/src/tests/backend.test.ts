import './testEnv';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from '../app';
import { closeDatabase } from '../db/database';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { app } = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDatabase();
});

async function api<T = any>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function post<T = any>(path: string, data: unknown): Promise<{ status: number; body: T }> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(data) });
}

describe('OrbitShield backend — multi-spacecraft/session control plane (spec sections 5–9, 14)', () => {
  it('onboarding creates a spacecraft entity + active session', async () => {
    const created = await api<{ session_id: string; spacecraft_id: string; entity: any }>('/spacecraft', {
      method: 'POST',
      body: JSON.stringify({
        spacecraft_id: 'TEST-01',
        name: 'Test Vehicle',
        mission_name: 'ORBITSHIELD-TEST-01',
        mission_type: 'Science',
        orbit_type: 'SUN_SYNCHRONOUS',
        orbit_altitude_km: 550,
        ground_station: 'GS-PRIMARY-01',
        operator_name: 'Test Operator'
      })
    });
    expect(created.status).toBe(201);
    expect(created.body.session_id).toBeDefined();
    expect(created.body.spacecraft_id).toBe('TEST-01');
    expect(created.body.entity?.spacecraft_id).toBe('TEST-01');
  });

  it('GET /api/sessions returns all sessions plus the active one', async () => {
    const { status, body } = await api('/sessions');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(typeof body.active).toBe('string');
    const active = body.sessions.find((s: any) => s.session_id === body.active);
    expect(active).toBeDefined();
    expect(active?.active).toBe(true);
  });

  it('POST /api/sessions/:id/activate switches the active session', async () => {
    const { body } = await api('/sessions');
    const target = body.sessions.find((s: any) => s.session_id !== body.active);
    if (!target) return;
    const { status, body: activated } = await api<{ activated: string; spacecraft_id: string }>(
      `/sessions/${target.session_id}/activate`,
      { method: 'POST' }
    );
    expect(status).toBe(200);
    expect(activated.activated).toBe(target.session_id);

    const { body: after } = await api('/sessions');
    const newActive = after.sessions.find((s: any) => s.session_id === target.session_id);
    expect(newActive?.active).toBe(true);
    const deactivated = after.sessions.find((s: any) => s.session_id !== target.session_id);
    expect(deactivated?.active).toBe(false);
  });

  it('GET /api/spacecraft returns the current active spacecraft', async () => {
    const { body } = await api('/spacecraft');
    expect(body.active_spacecraft_id).toBeDefined();
    expect(body.entities.some((e: any) => e.spacecraft_id === body.active_spacecraft_id)).toBe(true);
  });

  it('GET /api/spacecraft/:id/twin returns a valid deterministic visualization payload', async () => {
    const { status, body } = await api('/spacecraft/TEST-01/twin');
    expect(status).toBe(200);
    expect(body.spacecraft_id).toBe('TEST-01');
    expect(typeof body.position).toBe('object');
    expect(typeof body.orbit).toBe('object');
    expect(typeof body.security_posture).toBe('string');
    expect(['NORMAL', 'SUSPICIOUS', 'CRITICAL']).toContain(body.security_posture);
  });

  it('existing SAT-01 demo behavior is unchanged', async () => {
    const { status, body } = await api('/spacecraft/SAT-01');
    expect(status).toBe(200);
    expect(body.state?.spacecraft_id).toBe('SAT-01');
    expect(body.state?.operating_mode).toBe('NOMINAL');
  });
});
