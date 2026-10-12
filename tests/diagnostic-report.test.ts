import { describe, expect, it } from 'vitest';
import { diagnosticJson, diagnosticMessage, idleDiagnostic, inspectPartnerFields, sanitizeDiagnostic } from '../modules/ometv/diagnostic-report';

describe('partner metadata allowlist', () => {
  it('reads only partner and DialogData gender fields, preserving numeric ambiguity', () => {
    expect(inspectPartnerFields({ Gender: 1, DialogData: JSON.stringify({ sex: ' Female ', text: 'private chat' }),
      UserId: 'private-id', Country: 'private-country', ownGender: { gender: 'male' }, user: { gender: 'male' } })).toEqual([
      { path: 'interlocutor.Gender', format: 'number', value: 1 },
      { path: 'DialogData.sex', format: 'text', value: 'female' },
    ]);
  });

  it.each(['Alice', 'private@example.com', 12345678, { name: 'private' }, null, undefined, 'female@example.com'])
    ('withholds arbitrary field values: %s', value => {
      const report = inspectPartnerFields({ Gender: value });
      expect(report).toEqual([{ path: 'interlocutor.Gender', format: 'unrecognized' }]);
      expect(JSON.stringify(report)).not.toContain('private');
    });

  it('does not invoke accessors or inspect inherited fields', () => {
    const partner = Object.create({ Gender: 'male' });
    Object.defineProperty(partner, 'sex', { get: () => { throw new Error('Do not read'); } });
    expect(inspectPartnerFields(partner)).toEqual([]);
  });

  it.each(['{invalid', ' '.repeat(16385), 'null', '[]'])('ignores unusable DialogData', DialogData => {
    expect(inspectPartnerFields({ DialogData })).toEqual([]);
  });

  it('rebuilds messages and exported reports without extra properties or raw values', () => {
    const raw = { state: 'watching', checked: 2, withCandidate: 1, UserId: 'private-id',
      fields: [{ path: 'interlocutor.Gender', format: 'unrecognized', value: 'private-email', raw: 'private-chat' }] };
    const safe = sanitizeDiagnostic(raw)!;
    expect(safe.fields).toEqual([{ path: 'interlocutor.Gender', format: 'unrecognized' }]);
    expect(diagnosticJson(safe, '1.2.1')).not.toContain('private');
    expect(JSON.parse(diagnosticJson(safe, '1.2.1')).extensionVersion).toBe('1.2.1');
  });

  it.each([
    { state: 'invented' }, { checked: 21 }, { checked: -1 }, { checked: 1.5 }, { withCandidate: 3 },
    { fields: [{ path: 'interlocutor.UserId', format: 'text', value: 'male' }] },
    { fields: [{ path: 'interlocutor.Gender', format: 'text', value: 'private-email' }] },
    { fields: Array(9).fill({ path: 'interlocutor.Gender', format: 'number', value: 1 }) },
    { fields: [{ path: 'interlocutor.Gender', format: 'number', value: 1 }, { path: 'interlocutor.Gender', format: 'number', value: 2 }] },
    { issue: 'private-server-error' },
  ])('rejects malformed or out-of-scope bridge reports', patch => {
    expect(sanitizeDiagnostic({ ...idleDiagnostic(), checked: 2, ...patch })).toBeNull();
  });

  it('distinguishes unsupported inspection, absence in samples and unverified candidates', () => {
    expect(diagnosticMessage({ ...idleDiagnostic(), state: 'unavailable' })).toBe('Partner data could not be inspected');
    expect(diagnosticMessage({ ...idleDiagnostic(), state: 'watching', checked: 2 })).toBe('No gender field seen in checked connections');
    expect(diagnosticMessage({ ...idleDiagnostic(), state: 'watching', checked: 2, withCandidate: 1 })).toContain('meaning unverified');
  });
});
