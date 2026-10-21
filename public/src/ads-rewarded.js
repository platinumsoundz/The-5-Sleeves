// Thin wrapper around the AdSense H5 "reward" ad break. DOM-free until called
// and safe to import in Node, so the module contract test can load it.
//
// If the page has not been approved for games/rewarded ads (or an ad blocker
// eats the script), `playRewarded` resolves "unavailable" instead of hanging —
// the game then refuses the reward. Nothing is ever paid for a missing ad.
let configured = false;
let simulated = null;

export function adsSimulated() {
  if (simulated === null) {
    try {
      simulated = new URLSearchParams(window.location.search).get('ads') === 'sim';
    } catch (error) {
      simulated = false;
    }
  }
  return simulated;
}

export function adsAvailable() {
  return adsSimulated() || typeof window.adBreak === 'function';
}

// Ask AdSense to preload rewarded inventory. The script tag in index.html is
// async, so poll briefly instead of failing the first reward.
export function configureAds() {
  if (configured) return;
  const tryConfig = () => {
    if (typeof window.adConfig !== 'function') return false;
    try {
      window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
      configured = true;
    } catch (error) {
      configured = false;
    }
    return configured;
  };
  if (tryConfig()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (tryConfig() || tries >= 20) clearInterval(timer);
  }, 500);
}

// Resolves: 'viewed' | 'dismissed' | 'unavailable' | 'timeout'.
// `?ads=sim` fakes a view after `simulatedDelayMs` purely so the owner can
// test the UX on a device before AdSense approves the site for games ads.
export function playRewarded(name, options = {}) {
  const delay = Number(options.simulatedDelayMs) || 5000;
  if (adsSimulated()) return new Promise((resolve) => setTimeout(() => resolve('viewed'), delay));
  if (typeof window.adBreak !== 'function') return Promise.resolve('unavailable');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    const timer = setTimeout(() => finish('timeout'), Number(options.timeoutMs) || 120000);
    try {
      window.adBreak({
        type: 'reward',
        name: name || 'supply-transmission',
        beforeAd: () => {},
        afterAd: () => {},
        // The player already tapped the reward button; show the break at once.
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: () => finish('viewed'),
        adDismissed: () => finish('dismissed'),
        adBreakDone: (info) => {
          const status = info && info.breakStatus;
          if (status === 'viewed') finish('viewed');
          else if (status === 'dismissed') finish('dismissed');
          else finish('unavailable');
        }
      });
    } catch (error) {
      finish('unavailable');
    }
  });
}
