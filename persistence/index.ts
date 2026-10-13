import { createLocalRepository } from './localRepository';
import type { StrategyRepository } from './repository';

/**
 * The one place that decides where strategies are kept. Everything else
 * asks here and sees only the interface, so moving to the HTTP API is a
 * change to the line below and to nothing else.
 */

let repository: StrategyRepository | null = null;

/** Made on first use: storage does not exist until there is a browser. */
export function getStrategyRepository(): StrategyRepository {
  repository ??= createLocalRepository();
  return repository;
}

export {
  StrategyConflictError,
  StrategyNotFoundError,
  type StrategyChanges,
  type StrategyMeta,
  type StrategyRecord,
  type StrategyRepository,
} from './repository';
