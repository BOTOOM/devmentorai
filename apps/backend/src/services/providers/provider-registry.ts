import type { LLMProvider } from '@devmentorai/shared';
import type { LLMProviderAdapter } from './llm-provider.interface.js';

export class ProviderRegistry {
  private readonly providers = new Map<LLMProvider, LLMProviderAdapter>();

  register(provider: LLMProviderAdapter): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: LLMProvider): LLMProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  list(): LLMProviderAdapter[] {
    return Array.from(this.providers.values());
  }

  has(providerId: LLMProvider): boolean {
    return this.providers.has(providerId);
  }
}
