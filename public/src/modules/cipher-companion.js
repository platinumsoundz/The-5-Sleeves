export function shouldShowCipherIntro(payload) {
  return payload?.cipherIntro === true;
}

const LAYER_CSS = 'inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,8,14,.78);backdrop-filter:blur(7px);';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export default {
  name: 'cipher-companion',
  summary: 'Introduces the allied Cipher AI after an operative clears their first tower.',
  priority: 45,
  setup(ctx) {
    const layer = ctx.dom(LAYER_CSS);
    layer.setAttribute('role', 'presentation');
    const style = element('style');
    style.textContent = `
      .cipher-intro { display:flex; gap:22px; width:min(760px,94vw); padding:18px; border:1px solid #53dcff; border-radius:16px; background:linear-gradient(145deg,rgba(12,30,43,.98),rgba(5,13,23,.98)); box-shadow:0 0 44px #159cc855,inset 0 0 28px #24bfff18; color:#e8fbff; font:15px/1.55 system-ui,sans-serif; }
      .cipher-intro img { width:220px; max-width:38%; align-self:stretch; object-fit:cover; object-position:center 35%; border:1px solid #56dfff88; border-radius:11px; background:#07131d; box-shadow:0 0 20px #2fdfff33; }
      .cipher-copy { display:flex; flex:1; flex-direction:column; align-items:flex-start; }
      .cipher-kicker { color:#78eaff; font-size:11px; font-weight:800; letter-spacing:.16em; }
      .cipher-copy h2 { margin:8px 0 0; font-size:clamp(25px,5vw,36px); letter-spacing:.22em; }
      .cipher-role { margin:0 0 18px; color:#87dff3; font-size:11px; letter-spacing:.12em; }
      .cipher-copy p { margin:0 0 20px; color:#e2f5fa; }
      .cipher-copy button { margin-top:auto; padding:10px 18px; border:1px solid #61e8ff; border-radius:8px; background:#123544; color:white; font-weight:800; letter-spacing:.1em; cursor:pointer; }
      @media(max-width:560px) { .cipher-intro { flex-direction:column; gap:12px; max-height:90dvh; overflow:auto; } .cipher-intro img { width:100%; max-width:none; height:200px; object-position:center 28%; } .cipher-copy p { margin-bottom:14px; } }
    `;
    const panel = element('section', null, 'cipher-intro');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'cipher-intro-title');
    const portrait = element('img');
    portrait.src = '/assets/cipher-companion.svg';
    portrait.alt = 'Cipher, warmly smiling through a cyan holographic projection';
    const copy = element('div', null, 'cipher-copy');
    copy.append(
      element('div', 'TOWER LINK RESTORED · FIRST CONTACT', 'cipher-kicker'),
      Object.assign(element('h2', 'CIPHER'), { id: 'cipher-intro-title' }),
      element('div', 'AI / SPIRIT INTERFACE · ALLIED', 'cipher-role'),
      element('p', 'Thank you for bringing the tower back online. I was lost in the static. I’m Cipher. I’ll help you find the remaining towers—if you’ll have me.')
    );
    const close = element('button', 'CONTINUE');
    close.type = 'button';
    close.addEventListener('click', () => { layer.style.display = 'none'; });
    copy.append(close);
    panel.append(portrait, copy);
    layer.append(style, panel);
    layer.addEventListener('click', (event) => { if (event.target === layer) layer.style.display = 'none'; });
    ctx.on('net:tower-cleared', (payload) => {
      if (shouldShowCipherIntro(payload)) {
        layer.style.display = 'flex';
        close.focus();
      }
    });
  }
};
