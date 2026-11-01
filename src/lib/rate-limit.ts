// High-efficiency sliding window rate limiter & DoS Flood Protector.
// Specifically configured to distinguish between accidental double-clicks vs intentional floods/attacks.
// Threshold: If an IP exceeds 15 rapid requests -> Automatic HARD BLOCK for 30 MINUTES (1800 seconds).

interface IpBlockRecord {
  blockedUntil: number; // timestamp in ms
  reason: string;
  violations: number;
}

interface RequestTracker {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
  resetTime: number;
}

// In-memory stores
const blockedIps = new Map<string, IpBlockRecord>();
const requestTrackers = new Map<string, RequestTracker>();
const routeLimitStore = new Map<string, { count: number; resetTime: number }>();

// Block duration: 30 minutes in milliseconds
export const HARD_BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
// Tracking window for DoS detection: 1 minute
export const DOS_MONITOR_WINDOW_MS = 60 * 1000;
// Maximum rapid requests before triggering 30-minute block:
export const DOS_MAX_REQUESTS_THRESHOLD = 15;

// Periodically purge expired blocks and request trackers every 2 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, block] of blockedIps.entries()) {
      if (now > block.blockedUntil) {
        blockedIps.delete(ip);
      }
    }
    for (const [key, tracker] of requestTrackers.entries()) {
      if (now > tracker.resetTime) {
        requestTrackers.delete(key);
      }
    }
    for (const [key, record] of routeLimitStore.entries()) {
      if (now > record.resetTime) {
        routeLimitStore.delete(key);
      }
    }
  }, 2 * 60 * 1000).unref?.();
}

/**
 * Extracts client IP safely from Cloudflare Edge and reverse proxies
 */
export function getClientIp(request: Request): string {
  // Cloudflare primary header
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Forwarded for header (take the first leftmost client IP)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

export interface DosCheckResult {
  allowed: boolean;
  isBlocked: boolean;
  requestCount: number;
  retryAfterSeconds: number;
  message?: string;
}

/**
 * Intelligent DoS Flood Protection:
 * 1. Accidental burst (1 to 5 requests in a window): Normal, completely allowed.
 * 2. Rapid traffic (6 to 15 requests): Allowed but monitored.
 * 3. Flood / DoS (> 15 requests in monitoring window): Hard blocked for 30 minutes!
 */
export function checkDoSProtection(ip: string): DosCheckResult {
  const now = Date.now();

  // 1. Check if IP is currently under a 30-minute active block
  const activeBlock = blockedIps.get(ip);
  if (activeBlock) {
    if (now < activeBlock.blockedUntil) {
      const remainingSeconds = Math.ceil((activeBlock.blockedUntil - now) / 1000);
      return {
        allowed: false,
        isBlocked: true,
        requestCount: DOS_MAX_REQUESTS_THRESHOLD,
        retryAfterSeconds: remainingSeconds,
        message: `تم حظر هذا العنوان مؤقتاً لمدة 30 دقيقة بسبب تكرار الطلبات بشكل مريب (> 15 طلب). يُرجى المحاولة بعد ${Math.ceil(
          remainingSeconds / 60
        )} دقيقة.`,
      };
    } else {
      // 30 minutes expired, remove block
      blockedIps.delete(ip);
    }
  }

  // 2. Track rapid requests within the sliding window
  let tracker = requestTrackers.get(ip);
  if (!tracker || now > tracker.resetTime) {
    tracker = {
      count: 1,
      firstRequestTime: now,
      lastRequestTime: now,
      resetTime: now + DOS_MONITOR_WINDOW_MS,
    };
    requestTrackers.set(ip, tracker);
    return {
      allowed: true,
      isBlocked: false,
      requestCount: 1,
      retryAfterSeconds: 0,
    };
  }

  tracker.count += 1;
  tracker.lastRequestTime = now;

  // 3. Flood threshold exceeded (> 15 requests): Issue 30-minute block!
  if (tracker.count > DOS_MAX_REQUESTS_THRESHOLD) {
    const blockedUntil = now + HARD_BLOCK_DURATION_MS;
    blockedIps.set(ip, {
      blockedUntil,
      reason: `Flood/DoS Protection: Exceeded ${DOS_MAX_REQUESTS_THRESHOLD} requests within ${
        DOS_MONITOR_WINDOW_MS / 1000
      }s window`,
      violations: (activeBlock?.violations || 0) + 1,
    });
    // Reset tracker
    requestTrackers.delete(ip);

    return {
      allowed: false,
      isBlocked: true,
      requestCount: tracker.count,
      retryAfterSeconds: Math.ceil(HARD_BLOCK_DURATION_MS / 1000), // 1800 seconds
      message:
        "تم حظر هذا العنوان مؤقتاً لمدة 30 دقيقة لحماية السيرفر من هجمات الإغراق (تجاوزت 15 طلباً متكرراً).",
    };
  }

  return {
    allowed: true,
    isBlocked: false,
    requestCount: tracker.count,
    retryAfterSeconds: 0,
  };
}

export interface RouteRateLimitOptions {
  prefix: string;
  max: number;
  windowMs: number;
}

export interface RouteRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

/**
 * Route-specific rate limiter (e.g. for login attempts or coupon submissions)
 */
export function checkRateLimit(ip: string, options: RouteRateLimitOptions): RouteRateLimitResult {
  // First, verify IP is not blocked by DoS protection
  const dosCheck = checkDoSProtection(ip);
  if (!dosCheck.allowed) {
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      retryAfter: dosCheck.retryAfterSeconds,
    };
  }

  const now = Date.now();
  const key = `${options.prefix}:${ip}`;
  const record = routeLimitStore.get(key);

  if (!record || now > record.resetTime) {
    routeLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return {
      success: true,
      limit: options.max,
      remaining: options.max - 1,
      retryAfter: 0,
    };
  }

  if (record.count >= options.max) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit: options.max,
    remaining: options.max - record.count,
    retryAfter: 0,
  };
}

/**
 * Manually reset rate limit for a specific key (e.g. on successful login)
 */
export function resetRateLimit(ip: string, prefix: string): void {
  routeLimitStore.delete(`${prefix}:${ip}`);
}

/**
 * Unblock an IP (for administrative operations or testing)
 */
export function unblockIp(ip: string): void {
  blockedIps.delete(ip);
  requestTrackers.delete(ip);
}
