// Errors the CLI turns into clear messages and exit codes.

export class ConfigError extends Error {}

// technical = the provider broke (not the image). Technical failures trigger a
// fallback and never count as one of the two review attempts.
export class ProviderError extends Error {
  constructor(message, { provider, technical = true } = {}) {
    super(message);
    this.provider = provider;
    this.technical = technical;
  }
}
export class QuotaError extends ProviderError {}
export class SessionError extends ProviderError {}
export class PageChangedError extends ProviderError {}
