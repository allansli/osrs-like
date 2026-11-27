import { STATE } from '../state/gameState';
import { journalView } from '../state/story';
import { SKILLS_META } from '../data/skills';
import { ITEMS } from '../data/items';
import type { Cond } from '../state/dialogue';
import { openModal, closeModals, announceUnlocksSince } from './playerActions';
import { updateAllUI } from './hud';
import { dispatchCommand } from '../engine/actions';

function formatNeeds(cond: Cond): string {
  if ('combat' in cond) {
    return `Combat level ${cond.combat}`;
  }
  if ('skill' in cond) {
    const [sk, lvl] = cond.skill;
    const meta = SKILLS_META[sk as keyof typeof SKILLS_META];
    const name = meta ? meta.name : sk;
    return `${name} level ${lvl}`;
  }
  if ('quest' in cond) {
    const [qId, status] = cond.quest;
    return `${qId} (${status})`;
  }
  if ('claimed' in cond) {
    return `Claimed ${cond.claimed}`;
  }
  if ('starter' in cond) {
    const [id, st] = cond.starter;
    return `${id} (${st})`;
  }
  if ('gp' in cond) {
    return `${cond.gp.toLocaleString()} GP`;
  }
  if ('has' in cond) {
    const [itemId, qty] = cond.has;
    const item = ITEMS[itemId];
    return `${qty}× ${item ? item.name : itemId}`;
  }
  if ('stat' in cond) {
    const [key, n] = cond.stat;
    return `${key} (${n})`;
  }
  if ('all' in cond) {
    return cond.all.map(formatNeeds).filter(Boolean).join(', ');
  }
  if ('any' in cond) {
    return cond.any.map(formatNeeds).filter(Boolean).join(' or ');
  }
  if ('not' in cond) {
    return `Not (${formatNeeds(cond.not)})`;
  }
  if ('flag' in cond) {
    return cond.flag;
  }
  return '';
}

export function renderJournal(): void {
  const host = document.getElementById('log-tab-journal');
  if (!host) return;
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
      descEl.textContent = `Giver: ${q.giverName} · Place: ${q.region}`;
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

export function switchLogTab(tab: 'journal' | 'tasks' | 'diary'): void {
  const currentContent = activeLogTab === 'tasks' ? document.getElementById('quest-list') : document.getElementById(`log-tab-${activeLogTab}`);
  if (currentContent) {
    scrollPositions[activeLogTab] = currentContent.scrollTop;
  }

  activeLogTab = tab;
  const tabs = ['journal', 'tasks', 'diary'] as const;
  for (const t of tabs) {
    const btn = document.getElementById(`log-tab-btn-${t}`);
    const content = t === 'tasks' ? document.getElementById('quest-list') : document.getElementById(`log-tab-${t}`);
    const isActive = t === tab;
    if (btn) {
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    if (content) {
      content.classList.toggle('active', isActive);
      if (isActive) {
        content.scrollTop = scrollPositions[t] ?? 0;
      }
    }
  }
}

let tabsBound = false;

export function setupLogTabs(): void {
  if (tabsBound) return;
  const journalBtn = document.getElementById('log-tab-btn-journal');
  const tasksBtn = document.getElementById('log-tab-btn-tasks');
  const diaryBtn = document.getElementById('log-tab-btn-diary');
  if (journalBtn && tasksBtn && diaryBtn) {
    journalBtn.addEventListener('click', () => switchLogTab('journal'));
    tasksBtn.addEventListener('click', () => switchLogTab('tasks'));
    diaryBtn.addEventListener('click', () => switchLogTab('diary'));
    tabsBound = true;
  }
}

export function openEmberModal(itemId: string): void {
  const item = ITEMS[itemId];
  if (!item) return;
  const title = document.getElementById('ember-modal-title');
  if (title) title.textContent = `Empower Skill — ${item.name}`;
  const grid = document.getElementById('ember-skills-grid');
  if (grid) {
    grid.replaceChildren();
    for (const [key, meta] of Object.entries(SKILLS_META)) {
      if (!Object.hasOwn(STATE.skills, key)) continue;
      const sk = STATE.skills[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-btn';
      btn.textContent = `${meta.name} (Lv ${sk.lvl})`;
      btn.addEventListener('click', () => {
        const before = Object.fromEntries(Object.entries(STATE.skills).map(([k, s]) => [k, s.lvl]));
        const res = dispatchCommand({ kind: 'useEmber', itemId, skillKey: key });
        if (res.ok) {
          closeModals();
          announceUnlocksSince(before);
          updateAllUI();
        }
      });
      grid.appendChild(btn);
    }
  }
  openModal('ember-modal');
}
