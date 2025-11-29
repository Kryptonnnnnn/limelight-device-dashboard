interface GapBadgeProps {
    lastMessageTime: number | null;
  }
  
  export function GapBadge({ lastMessageTime }: GapBadgeProps) {
    if (!lastMessageTime) return null;
    const now = Date.now();
    const gapMs = now - lastMessageTime;
    const hasGap = gapMs > 10_000;
  
    if (!hasGap) {
      return (
        <span className="gap-ok" role="status" aria-live="polite">
          Live &lt;10 s
        </span>
      );
    }
  
    const seconds = Math.round(gapMs / 1000);
  
    return (
      <span
        className="gap-badge"
        role="status"
        aria-live="assertive"
        aria-label={`No data for ${seconds} seconds`}
      >
        No data &gt; 10 s ({seconds}s)
      </span>
    );
  }