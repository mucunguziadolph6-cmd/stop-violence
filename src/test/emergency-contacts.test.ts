import { describe, expect, it } from 'vitest';
import { RIB_CONTACT } from '@/lib/emergency-contacts';

describe('RIB emergency destinations', () => {
  it('uses RIB’s verified emergency number', () => {
    expect(RIB_CONTACT.emergencyNumber).toBe('166');
    expect(RIB_CONTACT.callUrl).toBe('tel:166');
  });
  it('opens the official RIB website without report data', () => {
    const url = new URL(RIB_CONTACT.websiteUrl);
    expect(url.origin).toBe('https://www.rib.gov.rw');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });
});