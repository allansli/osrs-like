import { NPCS } from '../data/npcs';
import { STATE } from '../state/gameState';
import { player } from '../engine/context';
import { dispatchCommand } from '../engine/actions';
import { addCommandListener, type PlayerCommand, type CommandResult } from '../state/commands';
import type { DialogueView } from '../state/dialogue';
import { openShopModal, openBankModal, openSmithingModal, openQuestsModal } from './playerActions';

let isOpen = false;
let currentView: DialogueView | null = null;
let currentNpc: (typeof NPCS)[number] | undefined;
let lastHp = 0;
let lastFocused: HTMLElement | null = null;
let animFrameId: number | null = null;

export function isDialogueOpen(): boolean {
  return isOpen;
}

export function getCurrentDialogueView(): DialogueView | null {
  return currentView;
}

export function showDialogue(view: DialogueView): void {
  if (typeof document === 'undefined') return;

  const panel = document.getElementById('dialogue-panel');
  const speakerEl = document.getElementById('dialogue-speaker');
  const sayEl = document.getElementById('dialogue-say');
  const optionsEl = document.getElementById('dialogue-options');
  if (!panel || !speakerEl || !sayEl || !optionsEl) return;

  const npc = NPCS.find((n) => n.id === view.npcId);
  if (player.downed || STATE.hp <= 0) return;
  if (npc) {
    const dist = Math.hypot(player.pos.x - npc.x, player.pos.z - npc.z);
    if (dist > 5.0) return;
  }

  if (!isOpen) {
    lastFocused = document.activeElement as HTMLElement | null;
  }

  currentView = view;
  currentNpc = npc;
  lastHp = STATE.hp;

  speakerEl.textContent = view.speaker;
  sayEl.textContent = view.say;

  optionsEl.textContent = '';

  view.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-btn dialogue-option-btn';

    const badge = document.createElement('span');
    badge.className = 'dialogue-key-badge';
    badge.textContent = String(i + 1);

    const label = document.createElement('span');
    label.textContent = opt.text;

    btn.appendChild(badge);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      chooseOptionIndex(opt.index);
    });

    optionsEl.appendChild(btn);
  });

  panel.hidden = false;

  if (!isOpen) {
    isOpen = true;
    window.addEventListener('keydown', handleKeyDown);
    if (typeof requestAnimationFrame === 'function') {
      animFrameId = requestAnimationFrame(monitorLoop);
    }
  }

  const firstBtn = optionsEl.querySelector<HTMLElement>('button');
  if (firstBtn) {
    firstBtn.focus();
  }
}

export function closeDialogue(): void {
  if (!isOpen) return;
  isOpen = false;
  currentView = null;
  currentNpc = undefined;

  if (animFrameId !== null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animFrameId);
    }
    animFrameId = null;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }

  if (typeof document !== 'undefined') {
    const panel = document.getElementById('dialogue-panel');
    if (panel) {
      panel.hidden = true;
    }
  }

  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus();
    lastFocused = null;
  }
}

function chooseOptionIndex(index: number): void {
  if (!currentView) return;
  const cmd: PlayerCommand = {
    kind: 'choose',
    npcId: currentView.npcId,
    nodeId: currentView.nodeId,
    index
  };
  dispatchCommand(cmd);
}

function handleKeyDown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeDialogue();
    return;
  }

  if (['1', '2', '3', '4'].includes(e.key)) {
    const num = parseInt(e.key, 10);
    const idx = num - 1;
    if (currentView && idx >= 0 && idx < currentView.options.length) {
      e.preventDefault();
      chooseOptionIndex(currentView.options[idx].index);
    }
  }
}

function checkDialogueAutoClose(): boolean {
  if (!isOpen) return false;
  if (player.downed || STATE.hp <= 0) {
    closeDialogue();
    return true;
  }
  if (STATE.hp < lastHp) {
    closeDialogue();
    return true;
  }
  lastHp = STATE.hp;

  if (currentNpc) {
    const dist = Math.hypot(player.pos.x - currentNpc.x, player.pos.z - currentNpc.z);
    if (dist > 5.0) {
      closeDialogue();
      return true;
    }
  }
  return false;
}

function monitorLoop(): void {
  if (!isOpen) return;
  if (checkDialogueAutoClose()) return;
  if (typeof requestAnimationFrame === 'function') {
    animFrameId = requestAnimationFrame(monitorLoop);
  }
}

function handleCommandResult(cmd: PlayerCommand, res: CommandResult): void {
  if (typeof document === 'undefined') return;

  if (cmd.kind === 'talk') {
    if (res.ok && res.view) {
      showDialogue(res.view);
    }
  } else if (cmd.kind === 'choose') {
    if (res.ok) {
      if (res.events && res.events.length > 0) {
        for (const ev of res.events) {
          if (ev.type === 'open') {
            closeDialogue();
            if (ev.target === 'shop') openShopModal('all');
            else if (ev.target === 'bank') openBankModal();
            else if (ev.target === 'forge') openSmithingModal();
            else if (ev.target === 'tasks') openQuestsModal();
          } else if (ev.type === 'enter') {
            closeDialogue();
            // dungeon command (a no-op until Z7)
          }
        }
      }
      if (res.view) {
        showDialogue(res.view);
      } else {
        closeDialogue();
      }
    } else {
      const sayEl = document.getElementById('dialogue-say');
      if (sayEl) {
        sayEl.textContent = 'Make room first.';
      }
    }
  }
}

addCommandListener(handleCommandResult);
