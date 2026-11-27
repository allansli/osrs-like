import { STATE } from '../state/gameState';
import { journalView } from '../state/story';
import { STORY_QUESTS } from '../data/story';
import { STARTER_QUESTS } from '../state/adventure';
import { SKILLS_META } from '../data/skills';
import { ITEMS } from '../data/items';
import { WORLD_REGIONS } from '../data/world';
import type { Cond } from '../state/dialogue';
import { openModal, closeModals, announceUnlocksSince } from './playerActions';
import { updateAllUI, el } from './hud';
import { dispatchCommand } from '../engine/actions';

const words = (id: string): string => id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_:]/g, ' ');
const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const questName = (id: string): string => [...STORY_QUESTS, ...STARTER_QUESTS].find((q) => q.id === id)!.name;

function formatNeeds(cond: Cond): string {
  if ('combat' in cond) return `Combat level ${cond.combat}`;
  if ('skill' in cond) {
    const [sk, lvl] = cond.skill;
    return `${SKILLS_META[sk as keyof typeof SKILLS_META].name} level ${lvl}`;
  }
  if ('quest' in cond) {
    const [qId, status] = cond.quest;
    const text = { none: 'not started', active: 'in progress', done: 'finished' }[status];
    return `${questName(qId)} ${text}`;
  }
  if ('stage' in cond) {
    const [qId, n] = cond.stage;
    return `${questName(qId)} stage ${n + 1}`;
  }
  if ('claimed' in cond) return `${questName(cond.claimed)} finished`;
  if ('starter' in cond) {
    const [id, st] = cond.starter;
    return `${questName(id)} ${st === 'ready' ? 'ready to hand in' : 'open'}`;
  }
  if ('gp' in cond) return `${cond.gp.toLocaleString()} GP`;
  if ('has' in cond) {
    const [itemId, qty] = cond.has;
    return `${qty}× ${ITEMS[itemId].name}`;
  }
  if ('stat' in cond) {
    const [key, n] = cond.stat;
    return `${capital(words(key))} ×${n}`;
  }
  if ('shrine' in cond) return `${capital(cond.shrine)} shrine found`;
  if ('all' in cond) return cond.all.map(formatNeeds).join(', ');
  if ('any' in cond) return cond.any.map(formatNeeds).join(' or ');
  if ('not' in cond) {
    const inner = cond.not;
    if ('claimed' in inner) {
      return inner.claimed === STARTER_QUESTS[0].id ? 'a hero from before the starter chain' : `${questName(inner.claimed)} not finished`;
    }
    return `Not (${formatNeeds(inner)})`;
  }
  return capital(words(cond.flag));
}

let finishedOpen = false;

export function renderJournal(): void {
  const host = el('log-tab-journal');
  const prevScroll = host.scrollTop;
  host.replaceChildren();

  const view = journalView(STATE);

  // Active quests
  const activeSec = document.createElement('div');
  activeSec.className = 'journal-section';
  const activeTitle = document.createElement('div');
  activeTitle.className = 'panel-header-title';
  activeTitle.textContent = 'Active Quests';
  activeSec.appendChild(activeTitle);

  if (view.active.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'journal-empty-line';
    empty.textContent = 'No active quests.';
    activeSec.appendChild(empty);
  } else {
    for (const q of view.active) {
      const card = document.createElement('article');
      card.className = 'quest-card';

      const titleRow = document.createElement('div');
      titleRow.className = 'quest-name';
      titleRow.textContent = (q.main ? '★ ' : '○ ') + q.name;
      card.appendChild(titleRow);

      const stageEl = document.createElement('div');
      stageEl.className = 'shop-card-desc';
      stageEl.textContent = q.stage;
      card.appendChild(stageEl);

      if (q.counts) {
        const countsEl = document.createElement('div');
        countsEl.className = 'quest-progress';
        countsEl.textContent = q.counts;
        card.appendChild(countsEl);
      }

      activeSec.appendChild(card);
    }
  }
  host.appendChild(activeSec);

  // Quests on offer
  if (view.offered.length > 0) {
    const offeredSec = document.createElement('div');
    offeredSec.className = 'journal-section';
    const offeredTitle = document.createElement('div');
    offeredTitle.className = 'panel-header-title';
    offeredTitle.textContent = 'Quests on Offer';
    offeredSec.appendChild(offeredTitle);

    for (const q of view.offered) {
      const card = document.createElement('article');
      card.className = 'quest-card';

      const titleRow = document.createElement('div');
      titleRow.className = 'quest-name';
      titleRow.textContent = (q.line === 'main' ? '★ ' : '○ ') + q.name;
      card.appendChild(titleRow);

      const descEl = document.createElement('div');
      descEl.className = 'shop-card-desc';
      descEl.textContent = `Giver: ${q.giverName} · Place: ${WORLD_REGIONS.find((r) => r.id === q.region)!.name}`;
      card.appendChild(descEl);

      const reqEl = document.createElement('div');
      reqEl.className = 'quest-reward';
      reqEl.textContent = `Needs: ${formatNeeds(q.needs)}`;
      card.appendChild(reqEl);

      offeredSec.appendChild(card);
    }
    host.appendChild(offeredSec);
  }

  // Finished quests (collapsed)
  const details = document.createElement('details');
  details.className = 'journal-finished-details';
  details.open = finishedOpen;
  details.addEventListener('toggle', () => {
    finishedOpen = details.open;
  });

  const summary = document.createElement('summary');
  summary.className = 'panel-header-title';
  summary.style.cursor = 'pointer';
  summary.textContent = `Completed Quests (${view.done.length})`;
  details.appendChild(summary);

  if (view.done.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'journal-empty-line';
    empty.textContent = 'None completed yet.';
    details.appendChild(empty);
  } else {
    for (const q of view.done) {
      const item = document.createElement('div');
      item.className = 'journal-done-item';
      item.textContent = `✓ ${q.name}`;
      details.appendChild(item);
    }
  }
  host.appendChild(details);

  host.scrollTop = prevScroll;
}

let activeLogTab: 'journal' | 'tasks' | 'diary' = 'journal';
const scrollPositions: Record<string, number> = {
  journal: 0,
  tasks: 0,
  diary: 0
};

const logContent = (t: 'journal' | 'tasks' | 'diary'): HTMLElement => el(t === 'tasks' ? 'quest-list' : `log-tab-${t}`);

export function switchLogTab(tab: 'journal' | 'tasks' | 'diary'): void {
  scrollPositions[activeLogTab] = logContent(activeLogTab).scrollTop;
  activeLogTab = tab;
  for (const t of ['journal', 'tasks', 'diary'] as const) {
    const btn = el(`log-tab-btn-${t}`);
    const content = logContent(t);
    const isActive = t === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    content.classList.toggle('active', isActive);
    if (isActive) content.scrollTop = scrollPositions[t];
  }
}

let tabsBound = false;

export function setupLogTabs(): void {
  if (tabsBound) return;
  el('log-tab-btn-journal').addEventListener('click', () => switchLogTab('journal'));
  el('log-tab-btn-tasks').addEventListener('click', () => switchLogTab('tasks'));
  el('log-tab-btn-diary').addEventListener('click', () => switchLogTab('diary'));
  tabsBound = true;
}

export function openEmberModal(itemId: string): void {
  const item = ITEMS[itemId];
  el('ember-modal-title').textContent = `Empower Skill — ${item.name}`;
  const grid = el('ember-skills-grid');
  grid.replaceChildren();
  for (const [key, meta] of Object.entries(SKILLS_META)) {
    const sk = STATE.skills[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-btn';
    btn.textContent = `${meta.name} (Lv ${sk.lvl})`;
    btn.addEventListener('click', () => {
      const before = Object.fromEntries(Object.entries(STATE.skills).map(([k, s]) => [k, s.lvl]));
      const res = dispatchCommand({ kind: 'useEmber', itemId, skillKey: key });
      if (!res.ok) return;
      closeModals();
      announceUnlocksSince(before);
      updateAllUI();
    });
    grid.appendChild(btn);
  }
  openModal('ember-modal');
}
