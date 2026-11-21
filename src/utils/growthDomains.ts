import { GROWTH_DOMAINS } from '../data/growthPresets.ts';
import { normalizedName } from './knowledge.ts';

export const GROWTH_DOMAIN_NAME_LIMIT = 80;

export function isGrowthDomains(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((domain) => typeof domain === 'string' && Boolean(domain.trim()) && domain.length <= GROWTH_DOMAIN_NAME_LIMIT)
    && new Set(value.map(normalizedName)).size === value.length;
}

export function growthDomainOptions(domains: readonly string[]): string[] {
  const names = new Map<string, string>();
  for (const name of [...GROWTH_DOMAINS, ...domains]) {
    const key = normalizedName(name);
    if (!names.has(key)) names.set(key, name.trim());
  }
  return [...names.values()];
}

export function hasGrowthDomain(domains: readonly string[], name: string): boolean {
  const key = normalizedName(name);
  return domains.some((domain) => normalizedName(domain) === key);
}

export function withGrowthDomain(domains: string[], name: string): string[] {
  const key = normalizedName(name);
  if (!key || hasGrowthDomain(domains, name)) return domains;
  return [...domains, GROWTH_DOMAINS.find((domain) => normalizedName(domain) === key) ?? name.trim()];
}
