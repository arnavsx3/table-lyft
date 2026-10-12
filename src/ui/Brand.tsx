export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <img src="/icon-48.png" width={compact ? 28 : 34} height={compact ? 28 : 34} alt="" />
      <span>TableLyft</span>
    </div>
  );
}
