import { Download, ScanSearch, Square } from 'lucide-react';
import { DIAGNOSTIC_LIMIT, diagnosticMessage, idleDiagnostic, type DiagnosticReport } from './diagnostic-report';

export const diagnosticStyles = `
  .partner-check { border-top: 1px solid #44454e; padding-top: 10px; margin: 12px 0; }
  .partner-check-heading, .partner-check-actions { display: flex; align-items: center; gap: 6px; }
  .partner-check-heading { justify-content: space-between; }
  .partner-check-title { color: #c3c5cf; font-size: 12px; font-weight: 600; }
  .partner-check button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 auto; padding: 5px; border: 0; border-radius: 4px; background: transparent; color: #c3c5cf; cursor: pointer; }
  .partner-check button:hover { background: #3c3d45; color: white; }
  .partner-check button:disabled { opacity: .45; cursor: default; }
  .partner-check-message { color: #c3c5cf; font-size: 12px; margin: 4px 0; overflow-wrap: anywhere; }
  .partner-check-count { color: #82d6bc; font-size: 11px; font-variant-numeric: tabular-nums; }
  .partner-check-fields { margin-top: 5px; color: #f1c880; font: 11px/1.45 monospace; overflow-wrap: anywhere; }
`;

export function PartnerDataCheck({ report = idleDiagnostic(), onStart, onStop, onDownload, disabled = false }: {
  report?: DiagnosticReport; onStart: () => void; onStop: () => void; onDownload: () => void; disabled?: boolean;
}) {
  const active = report.state === 'waiting' || report.state === 'watching';
  const label = active ? 'Stop partner data check' : 'Start partner data check';
  return <div className="partner-check" role="group" aria-label="Partner data check">
    <div className="partner-check-heading"><span className="partner-check-title">Partner data check</span>
      <div className="partner-check-actions"><button title={label} aria-label={label} disabled={disabled} onClick={active ? onStop : onStart}>
        {active ? <Square size={16} /> : <ScanSearch size={16} />}</button>
        <button title="Download diagnostic report" aria-label="Download diagnostic report" disabled={disabled || report.state === 'idle'} onClick={onDownload}><Download size={16} /></button>
      </div></div>
    <p className="partner-check-message" aria-live="polite">{diagnosticMessage(report)}</p>
    {report.state !== 'idle' && <div className="partner-check-count">Connections checked: {report.checked} / {DIAGNOSTIC_LIMIT}. With candidate field: {report.withCandidate}.</div>}
    {report.fields.length > 0 && <div className="partner-check-fields" aria-label="Last observed candidate fields">{report.fields.map(field =>
      <div key={field.path}>{field.path}: {field.format === 'unrecognized' ? 'value withheld' : String(field.value)}</div>)}</div>}
  </div>;
}
