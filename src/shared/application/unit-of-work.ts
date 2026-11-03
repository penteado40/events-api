/**
 * Runs work as one unit (ADR-0014): every write inside commits or rolls back
 * together, and a lock taken inside holds until the unit ends, so writes that
 * take the same lock run one after the other. A run inside another joins it.
 */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>
}
