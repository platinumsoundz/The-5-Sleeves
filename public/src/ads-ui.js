// Builds the two rewarded-ad surfaces: the safe-city supply bar and the tower
// death panel. A factory (not module top-level DOM) keeps the file importable
// in Node for the module contract test.

const BAR_CSS = 'left:50%;bottom:calc(var(--safe-b) + var(--tap-main) + 34px);transform:translateX(-50%);z-index:6;display:none;gap:6px;align-items:center;pointer-events:auto;';
const PANEL_CSS = 'left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;display:none;width:min(340px,86vw);padding:16px 18px;border:1px solid rgba(255,107,122,.55);border-radius:12px;background:rgba(6,14,24,.97);color:#ffe4e9;text-align:center;box-shadow:0 0 32px rgba(255,90,120,.18);pointer-events:auto;';
const PILL = 'padding:7px 11px;border:1px solid #67ffde;border-radius:999px;background:rgba(10,38,44,.94);color:#d9fff5;font:800 10px system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;';
const DANGER = 'padding:7px 11px;border:1px solid #a15366;border-radius:999px;background:#3a1d29;color:#ffd2dc;font:800 10px system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;';

function pill(text, css = PILL) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.style.cssText = css;
  return element;
}

// `dom(css)` is the module host's fixed-position layer helper.
export function createAdUi(dom) {
  const bar = dom(BAR_CSS);
  const creditButton = pill('SUPPLY +100 CR · AD');
  const shieldButton = pill('SHIELD 90s · AD');
  bar.append(creditButton, shieldButton);

  const panel = dom(PANEL_CSS);
  const title = document.createElement('div');
  title.textContent = 'SIGNAL LOST';
  title.style.cssText = 'font:800 15px system-ui,sans-serif;letter-spacing:.12em;color:#ffb3c1;';
  const copy = document.createElement('p');
  copy.style.cssText = 'margin:8px 0 12px;color:#d8a9b3;font:12px/1.45 system-ui,sans-serif;';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
  const watchButton = pill('WATCH · REJOIN');
  const leaveButton = pill('RETURN TO CITY', DANGER);
  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:8px;color:#8faeb2;font:10px system-ui,sans-serif;';
  actions.append(watchButton, leaveButton);
  panel.append(title, copy, actions, hint);

  return { bar, creditButton, shieldButton, panel, watchButton, leaveButton, hint, copy };
}
