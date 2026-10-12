const genderKeys = ['Gender', 'gender', 'Sex', 'sex'] as const;
const paths = ['interlocutor', 'DialogData'].flatMap(scope => genderKeys.map(key => `${scope}.${key}`));
const labels = new Set(['male', 'female', 'man', 'woman', 'boy', 'girl', 'm', 'f', 'couple', 'other', 'unknown', 'nonbinary', 'non-binary']);
export const DIAGNOSTIC_LIMIT = 20;
export const DIAGNOSTIC_CHANNEL = 'wingman-partner-check-v1';

export interface CandidateField {
  path: string;
  format: 'text' | 'number' | 'boolean' | 'unrecognized';
  value?: string | number | boolean;
}

export interface DiagnosticReport {
  state: 'idle' | 'waiting' | 'watching' | 'unavailable' | 'complete';
  checked: number;
  withCandidate: number;
  fields: CandidateField[];
  rootCodeTotals?: { code1: number; code2: number; otherOrMissing: number };
  issue?: 'bridge_unavailable' | 'store_unavailable' | 'unsupported_site';
}

export const idleDiagnostic = (): DiagnosticReport => ({ state: 'idle', checked: 0, withCandidate: 0, fields: [] });

export function ownValue(object: unknown, key: string): unknown {
  if (!object || typeof object !== 'object') return undefined;
  // Never invoke getters while inspecting third-party state.
  return Object.getOwnPropertyDescriptor(object, key)?.value;
}

function candidate(path: string, value: unknown): CandidateField {
  if (typeof value === 'string' && value.length <= 16 && labels.has(value.trim().toLowerCase())) {
    return { path, format: 'text', value: value.trim().toLowerCase() };
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) return { path, format: 'number', value };
  if (typeof value === 'boolean') return { path, format: 'boolean', value };
  return { path, format: 'unrecognized' };
}

export function inspectPartnerFields(partner: object): CandidateField[] {
  let dialog = ownValue(partner, 'DialogData');
  if (typeof dialog === 'string') {
    try { dialog = dialog.length <= 16384 ? JSON.parse(dialog) : undefined; }
    catch { dialog = undefined; }
  }
  const fields: CandidateField[] = [];
  for (const [scope, object] of [['interlocutor', partner], ['DialogData', dialog]] as const) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) continue;
    for (const key of genderKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor && 'value' in descriptor) fields.push(candidate(`${scope}.${key}`, descriptor.value));
    }
  }
  return fields;
}

// Page-world messages are untrusted. Rebuild a bounded, allowlisted report before display/export.
export function sanitizeDiagnostic(value: unknown): DiagnosticReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as DiagnosticReport;
  if (!['idle', 'waiting', 'watching', 'unavailable', 'complete'].includes(report.state)) return null;
  if (!Number.isInteger(report.checked) || report.checked < 0 || report.checked > DIAGNOSTIC_LIMIT) return null;
  if (!Number.isInteger(report.withCandidate) || report.withCandidate < 0 || report.withCandidate > report.checked) return null;
  if (!Array.isArray(report.fields) || report.fields.length > paths.length) return null;
  if (report.issue !== undefined && !['bridge_unavailable', 'store_unavailable', 'unsupported_site'].includes(report.issue)) return null;
  const fields: CandidateField[] = [];
  for (const field of report.fields) {
    if (!field || !paths.includes(field.path) || fields.some(existing => existing.path === field.path)) return null;
    const safe = candidate(field.path, field.value);
    if (field.format !== safe.format) return null;
    fields.push(safe);
  }
  let rootCodeTotals: DiagnosticReport['rootCodeTotals'];
  if (report.rootCodeTotals !== undefined) {
    const counts = report.rootCodeTotals;
    if (!counts || typeof counts !== 'object') return null;
    const { code1, code2, otherOrMissing } = counts;
    if (![code1, code2, otherOrMissing].every(count => Number.isInteger(count) && count >= 0 && count <= DIAGNOSTIC_LIMIT) ||
      code1 + code2 + otherOrMissing !== report.checked || code1 + code2 > report.withCandidate) return null;
    rootCodeTotals = { code1, code2, otherOrMissing };
  }
  return { state: report.state, checked: report.checked, withCandidate: report.withCandidate, fields,
    ...(rootCodeTotals ? { rootCodeTotals } : {}),
    ...(report.issue ? { issue: report.issue } : {}) };
}

export function diagnosticMessage(report: DiagnosticReport) {
  if (report.state === 'idle') return 'Not checked';
  if (report.state === 'unavailable') {
    if (report.issue === 'unsupported_site') return 'This check supports OmeTV only';
    if (report.issue === 'bridge_unavailable') return 'Check unavailable. Reload OmeTV and try again.';
    return 'Partner data could not be inspected';
  }
  if (report.state === 'waiting') return 'Looking for partner data';
  if (report.withCandidate > 0) return 'Candidate gender field observed; meaning unverified';
  if (report.checked > 0) return 'No gender field seen in checked connections';
  if (report.state === 'complete') return 'No connection samples captured';
  return 'Check ready. Waiting for a connection.';
}

export function diagnosticJson(report: DiagnosticReport, version: string) {
  const safe = sanitizeDiagnostic(report);
  if (!safe) throw new Error('Invalid diagnostic report');
  return JSON.stringify({ extensionVersion: version, method: 'OmeTV partner-state allowlist v2',
    ...safe, result: diagnosticMessage(safe),
    note: 'Only interlocutor and DialogData Gender/gender/Sex/sex fields were checked. rootCodeTotals counts exact root Gender numbers 1 and 2 at the first sample of each distinct partner object; all other or missing values share one bucket. These are raw code totals, not gender totals, unique people or a timeline. The code-to-gender assumption was withdrawn after reported incorrect skips. Fields and numeric meanings remain unverified. Page data is untrusted. No media, chat, user IDs or per-person history included.' }, null, 2);
}

export function downloadDiagnostic(report: DiagnosticReport, version: string) {
  const url = URL.createObjectURL(new Blob([diagnosticJson(report, version)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'wingman-partner-check.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
