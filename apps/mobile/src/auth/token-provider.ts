export interface TokenProvider {
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>;
  registerAuthenticatedRequest(controller: AbortController): () => void;
}
