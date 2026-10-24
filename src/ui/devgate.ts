import { isDev, lock, unlock } from '../mode';

/**
 * The door to dev mode: a small lock in the corner of the game. It asks for the password; when it is right the page
 * reloads in dev mode. In dev mode a badge at the top says so and has the way back to the game.
 */
export function initDevGate() {
  const dev = isDev();
  document.body.classList.toggle('game', !dev);
  document.body.classList.toggle('dev', dev);
  const host = document.getElementById('hud')!;
  if (dev) {
    const badge = document.createElement('div');
    badge.id = 'devBadge';
    badge.innerHTML = 'DEV MODE <button>Back to the game</button>';
    badge.querySelector('button')!.onclick = () => lock();
    host.appendChild(badge);
    return;
  }
  const btn = document.createElement('button');
  btn.id = 'devBtn';
  btn.title = 'Developer';
  btn.textContent = '🔒';
  host.appendChild(btn);
  const box = document.createElement('div');
  box.id = 'devBox';
  box.className = 'panel';
  box.innerHTML = '<b>Developer mode</b><input type="password" placeholder="Password" autocomplete="off" /><div class="msg"></div><div class="row"><button class="go">Enter</button><button class="no">Cancel</button></div>';
  host.appendChild(box);
  const input = box.querySelector('input')!, msg = box.querySelector('.msg') as HTMLElement;
  const close = () => { box.classList.remove('on'); input.value = ''; msg.textContent = ''; };
  const submit = async () => {
    if (await unlock(input.value)) { location.hash = ''; location.reload(); return; }
    msg.textContent = 'Wrong password.';
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    input.select();
  };
  btn.onclick = () => { box.classList.add('on'); input.focus(); };
  (box.querySelector('.go') as HTMLElement).onclick = submit;
  (box.querySelector('.no') as HTMLElement).onclick = close;
  // (the game's keys must not act while she types the password)
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void submit(); else if (e.key === 'Escape') close(); });
  input.addEventListener('keyup', (e) => e.stopPropagation());
}
