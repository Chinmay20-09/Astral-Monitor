import { Router } from 'express';
import { GroundStationRepository, GroundStationSnapshot } from '../db/repositories/groundStationRepository';

/**
 * GET /api/ground-stations — sanitized ground-station registry snapshot for the
 * operator console dropdowns. Built from the persisted registry rows, which by
 * schema contain NO credential material: `secret_key` and `encryption_key` live
 * only in the backend's in-memory registry and never leave the backend process.
 */
export function groundStationsRouter(): Router {
  const router = Router();
  const repository = new GroundStationRepository();

  router.get('/', (_req, res) => {
    const stations: GroundStationSnapshot[] = repository.list().map(GroundStationRepository.toSnapshot);
    res.json({ total: stations.length, stations });
  });

  return router;
}
