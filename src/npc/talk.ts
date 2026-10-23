import type { Vector3 } from 'three';
import type { Player } from '../player/player';
import type { Sound } from '../audio/sound';
import { Npc } from './npc';

/**
 * Talking to NPCs. Near one, a prompt comes up ("F: talk"); F starts the conversation, and F again goes on to the next
 * line, and after the last she is free and so is the player. The player stands still while it lasts, and it ends
 * by itself if she is pulled away (a teleport) or the NPC is out of reach.
 */
export class TalkUI {
  private box: HTMLElement;
  private who: HTMLElement;
  private text: HTMLElement;
  private hint: HTMLElement;
  private near: Npc | null = null;
  private active: Npc | null = null;

  /** Called when a talk with a shopkeeper ends. */
  onShop: (() => void) | null = null;
  /** True while something else (the bag) has the screen: F does nothing here. */
  blocked: (() => boolean) | null = null;

  constructor(private player: Player, private npcs: Npc[], host: HTMLElement, private sound?: Sound) {
    this.box = document.createElement('div');
    this.box.id = 'talk';
    this.box.className = 'panel';
    this.box.innerHTML = '<div class="who"></div><p></p><div class="hint"></div>';
    host.appendChild(this.box);
    this.who = this.box.querySelector('.who')!;
    this.text = this.box.querySelector('p')!;
    this.hint = this.box.querySelector('.hint')!;
    this.box.onclick = () => this.press();
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.code === 'KeyF' && !e.repeat) this.press();
    });
  }

  /** F (or a click on the box): start talking to the one in reach, or go on to the next line. */
  press(chat = false) {
    if (this.blocked?.()) return;
    if (this.active) {
      const line = this.active.nextLine();
      if (line === null) this.finish();
      else this.show(this.active, line);
    } else if (this.near && this.near.def.shop && !chat) {
      // a shopkeeper: F opens the shop (there is a button there to chat)
      this.onShop?.();
    } else if (this.near) {
      this.active = this.near;
      this.near.startTalk();
      this.player.frozen = true;
      this.show(this.near, this.near.currentLine ?? '');
    }
  }

  private show(n: Npc, line: string) {
    this.who.textContent = `${n.def.name} · ${n.def.jp}`;
    this.text.textContent = line;
    this.sound?.speak(n.def.id, line);
    const last = n.line >= n.def.lines.length - 1;
    this.hint.textContent = last ? 'F: goodbye' : 'F: next';
    this.box.classList.add('on');
  }

  private finish() {
    this.sound?.stopSpeak();
    this.active = null;
    this.player.frozen = false;
    this.box.classList.remove('on');
  }

  /** Every frame: find the NPC in reach (the nearest), and show or hide the prompt. */
  update(at: Vector3) {
    if (this.blocked?.()) { this.box.classList.remove('on'); return; }
    if (this.active && !this.active.canTalk(at) && Math.hypot(at.x - this.active.pos.x, at.z - this.active.pos.z) > 4.5) { this.active.endTalk(); this.finish(); }
    if (this.active) return;
    let best: Npc | null = null, bd = Infinity;
    for (const n of this.npcs) {
      if (!n.canTalk(at)) continue;
      const d = Math.hypot(at.x - n.pos.x, at.z - n.pos.z);
      if (d < bd) { best = n; bd = d; }
    }
    this.near = best;
    if (best) {
      this.who.textContent = `${best.def.name} · ${best.def.jp}`;
      this.text.textContent = best.def.role;
      this.hint.textContent = best.def.shop ? 'F: shop' : 'F: talk';
      this.box.classList.add('on');
    } else this.box.classList.remove('on');
  }

  get talking() {
    return !!this.active;
  }
}
