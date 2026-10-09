/**
 * LRU (Least Recently Used) Engine for Water Keg Tracking
 * 
 * Determines who is next to fill the keg and calculates urgency/push scores
 * based on elapsed time and fill deficit relative to the household fair quota.
 */

export function calculateLRUQueue(roommates = [], totalHouseholdFills = 0, queueMode = 'fairness-weighted') {
  if (!roommates || roommates.length === 0) return [];

  const now = Date.now();
  const activeRoommates = roommates.filter(r => r.status !== 'away');
  const fairShare = activeRoommates.length > 0 ? totalHouseholdFills / activeRoommates.length : 0;

  // Clone and enrich with metrics
  const scored = roommates.map(r => {
    const isAway = r.status === 'away';
    const lastFilledTime = r.lastFilledAt ? new Date(r.lastFilledAt).getTime() : 0;
    const hasFilled = !!r.lastFilledAt;
    
    // Elapsed time in hours and days
    const elapsedMs = hasFilled ? Math.max(0, now - lastFilledTime) : Infinity;
    const elapsedDays = hasFilled ? Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) : Infinity;
    const elapsedHours = hasFilled ? Math.floor(elapsedMs / (1000 * 60 * 60)) : Infinity;

    // Fill deficit compared to household fair share
    const totalFills = r.totalFills || 0;
    const deficit = Number((fairShare - totalFills).toFixed(1));
    const fillPercentage = totalHouseholdFills > 0 
      ? Math.round((totalFills / totalHouseholdFills) * 100) 
      : 0;

    // Determine Urgency / Push Level
    let urgencyLevel = 'good'; // 'good' | 'warning' | 'urgent' | 'away'
    let urgencyLabel = 'Good Standing';

    if (isAway) {
      urgencyLevel = 'away';
      urgencyLabel = 'Away / Snoozed';
    } else if (!hasFilled || totalFills === 0) {
      urgencyLevel = 'urgent';
      urgencyLabel = 'Never Filled (Priority)';
    } else if (deficit >= 1.5 || elapsedDays >= 4) {
      urgencyLevel = 'urgent';
      urgencyLabel = 'Overdue / High Urgency';
    } else if (deficit >= 0.5 || elapsedDays >= 2) {
      urgencyLevel = 'warning';
      urgencyLabel = 'Due Soon';
    }

    return {
      ...r,
      hasFilled,
      totalFills,
      elapsedMs,
      elapsedDays,
      elapsedHours,
      deficit,
      fillPercentage,
      urgencyLevel,
      urgencyLabel,
    };
  });

  // Sorting based on chosen queueMode:
  // 1. 'fairness-weighted' (Default):
  //    Primary goal is equalizing total fills. Roommates with fewer total fills
  //    are placed first. LRU time is used as the sub-rotation among roommates with equal fills.
  // 2. 'pure-lru':
  //    Strictly ordered by elapsed time since last fill.
  scored.sort((a, b) => {
    // 1. Away users go to the bottom
    if (a.status === 'away' && b.status !== 'away') return 1;
    if (a.status !== 'away' && b.status === 'away') return -1;

    if (queueMode === 'fairness-weighted') {
      // Prioritize roommates who have done fewer total refills
      if (a.totalFills !== b.totalFills) {
        return a.totalFills - b.totalFills;
      }

      // If tied on total fills, rotate by LRU (whoever filled longer ago goes first)
      if (!a.hasFilled && b.hasFilled) return -1;
      if (a.hasFilled && !b.hasFilled) return 1;
      if (a.hasFilled && b.hasFilled) {
        if (a.elapsedMs !== b.elapsedMs) {
          return b.elapsedMs - a.elapsedMs;
        }
      }
    } else {
      // Pure LRU (Time only)
      if (!a.hasFilled && b.hasFilled) return -1;
      if (a.hasFilled && !b.hasFilled) return 1;
      if (a.hasFilled && b.hasFilled) {
        if (a.elapsedMs !== b.elapsedMs) {
          return b.elapsedMs - a.elapsedMs;
        }
      }
      if (b.deficit !== a.deficit) {
        return b.deficit - a.deficit;
      }
    }

    return a.name.localeCompare(b.name);
  });

  return scored;
}

export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never filled';
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffSec = Math.max(0, Math.floor((now - time) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
