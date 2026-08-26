export interface TokenProvider {
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>;
  invalidateSession(): Promise<void>;
  registerAuthenticatedRequest(controller: AbortController): () => void;
}
