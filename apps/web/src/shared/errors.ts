export class ConnectionDeletedError extends Error {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} was deleted during sync`);
    this.name = 'ConnectionDeletedError';
  }
}
