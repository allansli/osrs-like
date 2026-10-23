// @ts-nocheck
export function hexToCss(num) {
  return '#' + (num >>> 0).toString(16).padStart(6, '0');
}

export function getUiSvg(kind) {
  switch (kind) {
    case 'crest':
      return `<svg viewBox="0 0 32 32"><polygon points="16,3 24,16 16,16" fill="#fde047"/><polygon points="8,17 16,17 12,28" fill="#fde047"/><polygon points="16,17 24,17 20,28" fill="#eab308"/><circle cx="16" cy="16" r="14" fill="none" stroke="#d8b556" stroke-width="1.8"/></svg>`;
    case 'hp':
      return `<svg viewBox="0 0 32 32"><path d="M16 28 C16 28 4 19 4 10.5 C4 6.2 7.5 3.5 11.2 3.5 C13.6 3.5 15.2 4.8 16 6.5 C16.8 4.8 18.4 3.5 20.8 3.5 C24.5 3.5 28 6.2 28 10.5 C28 19 16 28 16 28 Z" fill="#ef4444" stroke="#fca5a5" stroke-width="1.5"/></svg>`;
    case 'prayer':
      return `<svg viewBox="0 0 32 32"><polygon points="16,2 19.5,12.5 30,16 19.5,19.5 16,30 12.5,19.5 2,16 12.5,12.5" fill="#38bdf8" stroke="#bae6fd" stroke-width="1.3"/><circle cx="16" cy="16" r="3.5" fill="#fff"/></svg>`;
    case 'spec':
      return `<svg viewBox="0 0 32 32"><polygon points="18,2 7,17 15,17 13,30 25,14 16.5,14" fill="#facc15" stroke="#fef08a" stroke-width="1.3"/></svg>`;
    case 'coins':
      return `<svg viewBox="0 0 32 32"><ellipse cx="14" cy="18" rx="9" ry="7" fill="#ca8a04" stroke="#fef08a" stroke-width="1.2"/><ellipse cx="18" cy="13" rx="9" ry="7" fill="#facc15" stroke="#fef08a" stroke-width="1.4"/><circle cx="18" cy="13" r="4" fill="none" stroke="#a16207" stroke-width="1.2"/></svg>`;
    case 'tab_combat':
      return `<svg viewBox="0 0 32 32"><path d="M6 26 L25 7 M21 5 L27 5 L27 11" stroke="#f87171" stroke-width="2.6" stroke-linecap="round"/><path d="M26 26 L7 7 M5 11 L5 5 L11 5" stroke="#fbbf24" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    case 'tab_skills':
      return `<svg viewBox="0 0 32 32"><rect x="4" y="18" width="6" height="10" rx="1" fill="#38bdf8"/><rect x="13" y="11" width="6" height="17" rx="1" fill="#22c55e"/><rect x="22" y="5" width="6" height="23" rx="1" fill="#facc15"/></svg>`;
    case 'tab_inv':
      return `<svg viewBox="0 0 32 32"><path d="M8 10 C8 6 12 4 16 4 C20 4 24 6 24 10" fill="none" stroke="#d97706" stroke-width="2.5"/><rect x="6" y="9" width="20" height="19" rx="4" fill="#92400e" stroke="#f59e0b" stroke-width="1.6"/><rect x="13" y="15" width="6" height="5" rx="1" fill="#fde047"/></svg>`;
    case 'tab_equip':
      return `<svg viewBox="0 0 32 32"><path d="M16 3 L27 8 L25 20 C23 25 16 29 16 29 C16 29 9 25 7 20 L5 8 Z" fill="#3b82f6" stroke="#e2e8f0" stroke-width="1.8"/><path d="M16 6 L16 26" stroke="#93c5fd" stroke-width="1.5"/></svg>`;
    case 'tab_magic':
      return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="#581c87" stroke="#c084fc" stroke-width="1.8"/><path d="M16 8 C20 12 20 20 16 24 C12 20 12 12 16 8 Z" fill="#38bdf8"/><circle cx="16" cy="16" r="3" fill="#fff"/></svg>`;
    default:
      return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#d8b556"/></svg>`;
  }
}

export function getSkillSvg(skillKey) {
  switch (skillKey) {
    case 'attack':
      return `<svg viewBox="0 0 32 32"><path d="M6 26 L26 6" stroke="#ef4444" stroke-width="3.2" stroke-linecap="round"/><polygon points="26,4 28,12 20,6" fill="#fca5a5"/><path d="M8 19 L13 24" stroke="#facc15" stroke-width="2.5"/></svg>`;
    case 'strength':
      return `<svg viewBox="0 0 32 32"><path d="M7 22 C6 15 11 9 18 9 C23 9 26 13 25 18 C24 23 19 26 12 26 Z" fill="#dc2626" stroke="#fca5a5" stroke-width="1.6"/><circle cx="19" cy="15" r="4" fill="#ef4444"/></svg>`;
    case 'defence':
      return `<svg viewBox="0 0 32 32"><path d="M16 3 L27 7 L25 19 C23 25 16 29 16 29 C16 29 9 25 7 19 L5 7 Z" fill="#0284c7" stroke="#bae6fd" stroke-width="1.8"/><polygon points="16,7 22,15 16,24 10,15" fill="#38bdf8"/></svg>`;
    case 'hitpoints':
      return getUiSvg('hp');
    case 'ranged':
      return `<svg viewBox="0 0 32 32"><path d="M9 4 C23 9 23 23 9 28" fill="none" stroke="#a16207" stroke-width="2.8"/><line x1="9" y1="4" x2="9" y2="28" stroke="#e2e8f0" stroke-width="1.3"/><line x1="5" y1="16" x2="26" y2="16" stroke="#22c55e" stroke-width="2.2"/><polygon points="28,16 22,13 22,19" fill="#4ade80"/></svg>`;
    case 'magic':
      return `<svg viewBox="0 0 32 32"><path d="M16 3 L23 15 L29 27 L3 27 L9 15 Z" fill="#3b82f6" stroke="#93c5fd" stroke-width="1.6"/><circle cx="16" cy="18" r="4.5" fill="#fde047"/></svg>`;
    case 'prayer':
      return getUiSvg('prayer');
    case 'woodcutting':
      return `<svg viewBox="0 0 32 32"><path d="M16 4 C10 4 6 9 6 14 C6 19 11 22 16 22 C21 22 26 19 26 14 C26 9 22 4 16 4 Z" fill="#16a34a" stroke="#86efac" stroke-width="1.4"/><rect x="13.5" y="20" width="5" height="9" fill="#78350f"/></svg>`;
    case 'mining':
      return `<svg viewBox="0 0 32 32"><path d="M6 12 C12 5 20 5 26 12" fill="none" stroke="#94a3b8" stroke-width="3.4" stroke-linecap="round"/><line x1="16" y1="8" x2="16" y2="28" stroke="#92400e" stroke-width="3"/></svg>`;
    case 'smithing':
      return `<svg viewBox="0 0 32 32"><path d="M5 12 L27 12 L23 18 L9 18 Z" fill="#475569" stroke="#cbd5e1" stroke-width="1.4"/><rect x="11" y="18" width="10" height="6" fill="#334155"/><rect x="7" y="24" width="18" height="4" fill="#1e293b"/></svg>`;
    case 'fishing':
      return `<svg viewBox="0 0 32 32"><path d="M4 16 C9 9 20 9 27 16 C20 23 9 23 4 16 Z" fill="#0ea5e9" stroke="#bae6fd" stroke-width="1.5"/><polygon points="26,16 30,11 30,21" fill="#0284c7"/><circle cx="10" cy="14.5" r="1.5" fill="#fff"/></svg>`;
    case 'cooking':
      return `<svg viewBox="0 0 32 32"><path d="M16 4 C22 11 25 16 23 23 C21 27 16 29 12 27 C8 25 7 18 11 13 C13 10 15 7 16 4 Z" fill="#f97316" stroke="#fde047" stroke-width="1.5"/><circle cx="15" cy="21" r="4" fill="#fef08a"/></svg>`;
    default:
      return getUiSvg('crest');
  }
}

export function getItemSvg(item) {
  if (!item) return '';
  const c1 = hexToCss(item.color || 0xd1d5db);
  const c2 = hexToCss(item.trim || item.color || 0xfacc15);
  const iconKind = item.iconKind || item.slot || item.type;

  switch (iconKind) {
    case 'scimitar':
      return `<svg viewBox="0 0 36 36"><path d="M8 27 C14 21 20 11 28 5 C29 12 24 21 13 27 Z" fill="${c1}" stroke="#ffffff" stroke-width="1"/><path d="M7 24 L14 31" stroke="${c2}" stroke-width="2.6" stroke-linecap="round"/><line x1="6" y1="30" x2="10" y2="26" stroke="#78350f" stroke-width="3"/></svg>`;
    case 'sword':
    case 'weapon':
      return `<svg viewBox="0 0 36 36"><polygon points="29,5 24,7 9,22 14,27 29,12" fill="${c1}" stroke="#fff" stroke-width="0.9"/><line x1="8" y1="20" x2="16" y2="28" stroke="${c2}" stroke-width="2.8" stroke-linecap="round"/><line x1="6" y1="30" x2="11" y2="25" stroke="#78350f" stroke-width="3"/><circle cx="5.5" cy="30.5" r="2" fill="${c2}"/></svg>`;
    case 'greatsword':
      return `<svg viewBox="0 0 36 36"><polygon points="31,3 24,5 8,21 15,28 31,12" fill="${c1}" stroke="${c2}" stroke-width="1.2"/><path d="M6 19 L17 30" stroke="${c2}" stroke-width="3.4" stroke-linecap="round"/><line x1="4" y1="32" x2="11" y2="25" stroke="#451a03" stroke-width="3.4"/></svg>`;
    case 'greataxe':
      return `<svg viewBox="0 0 36 36"><line x1="6" y1="30" x2="28" y2="8" stroke="#78350f" stroke-width="3.2" stroke-linecap="round"/><path d="M16 7 C21 2 28 4 30 9 C25 11 21 12 16 7 Z" fill="${c1}" stroke="${c2}" stroke-width="1.2"/><path d="M29 20 C34 15 32 8 27 6 C25 11 24 15 29 20 Z" fill="${c1}" stroke="${c2}" stroke-width="1.2"/></svg>`;
    case 'mace':
      return `<svg viewBox="0 0 36 36"><line x1="7" y1="29" x2="23" y2="13" stroke="#57534e" stroke-width="3.2" stroke-linecap="round"/><circle cx="25" cy="11" r="6" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><polygon points="25,2 27,5 23,5" fill="${c2}"/><polygon points="34,11 31,13 31,9" fill="${c2}"/></svg>`;
    case 'whip':
      return `<svg viewBox="0 0 36 36"><path d="M7 28 C5 18 16 12 24 16 C30 19 27 28 19 26 C13 24 17 17 22 19" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="31" x2="9" y2="26" stroke="${c2}" stroke-width="3.2"/></svg>`;
    case 'bow':
      return `<svg viewBox="0 0 36 36"><path d="M10 4 C27 10 27 26 10 32" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="4" x2="10" y2="32" stroke="#e2e8f0" stroke-width="1.2"/><line x1="6" y1="18" x2="29" y2="18" stroke="${c2}" stroke-width="2"/><polygon points="31,18 25,15 25,21" fill="${c2}"/></svg>`;
    case 'crossbow':
      return `<svg viewBox="0 0 36 36"><path d="M8 12 C18 4 28 14 24 26" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/><line x1="7" y1="29" x2="27" y2="9" stroke="#78350f" stroke-width="3.2" stroke-linecap="round"/><line x1="9" y1="12" x2="24" y2="25" stroke="#e2e8f0" stroke-width="1.3"/></svg>`;
    case 'staff':
    case 'wand':
      return `<svg viewBox="0 0 36 36"><line x1="7" y1="30" x2="25" y2="12" stroke="#78350f" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="9" r="5.5" fill="${c1}" stroke="${c2}" stroke-width="1.6"/><circle cx="25.5" cy="7.5" r="1.8" fill="#fff"/></svg>`;
    case 'head':
      return `<svg viewBox="0 0 36 36"><path d="M9 26 L9 15 C9 8 14 5 18 5 C22 5 27 8 27 15 L27 26 L22 28 L18 23 L14 28 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="12" y="14" width="12" height="3.5" rx="1" fill="#0f172a"/><path d="M18 2 L22 6 L14 6 Z" fill="${c2}"/></svg>`;
    case 'hat':
      return `<svg viewBox="0 0 36 36"><path d="M4 26 Q18 22 32 26 L26 22 L20 5 L13 13 L10 22 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><path d="M10 22 Q18 20 26 22" fill="none" stroke="${c2}" stroke-width="2.4"/></svg>`;
    case 'hood':
      return `<svg viewBox="0 0 36 36"><path d="M8 28 C7 14 12 6 18 5 C24 6 29 14 28 28 L22 30 L18 25 L14 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.6"/><ellipse cx="18" cy="18" rx="5.5" ry="6.5" fill="#0f172a"/></svg>`;
    case 'circlet':
      return `<svg viewBox="0 0 36 36"><ellipse cx="18" cy="20" rx="11" ry="6" fill="none" stroke="${c2}" stroke-width="3"/><polygon points="18,9 22,16 18,21 14,16" fill="${c1}" stroke="#fff" stroke-width="1"/></svg>`;
    case 'body':
      return `<svg viewBox="0 0 36 36"><path d="M8 9 L13 6 L18 9 L23 6 L28 9 L31 16 L26 18 L25 30 L11 30 L10 18 L5 16 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><line x1="18" y1="9" x2="18" y2="29" stroke="${c2}" stroke-width="1.3"/></svg>`;
    case 'robe_top':
      return `<svg viewBox="0 0 36 36"><path d="M7 9 L13 6 L18 11 L23 6 L29 9 L33 19 L27 21 L26 30 L10 30 L9 21 L3 19 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><path d="M14 7 L18 16 L22 7" fill="none" stroke="${c2}" stroke-width="1.8"/><rect x="10" y="20" width="16" height="2.8" fill="${c2}"/></svg>`;
    case 'dhide_body':
      return `<svg viewBox="0 0 36 36"><path d="M7 10 C10 5 15 6 18 8 C21 6 26 5 29 10 L31 16 L25 18 L24 29 L12 29 L11 18 L5 16 Z" fill="${c1}" stroke="${c2}" stroke-width="1.6"/><circle cx="14" cy="14" r="1.4" fill="${c2}"/><circle cx="22" cy="14" r="1.4" fill="${c2}"/><circle cx="14" cy="20" r="1.4" fill="${c2}"/><circle cx="22" cy="20" r="1.4" fill="${c2}"/></svg>`;
    case 'tunic':
      return `<svg viewBox="0 0 36 36"><path d="M8 9 L14 6 L18 9 L22 6 L28 9 L31 16 L26 18 L27 30 L9 30 L10 18 L5 16 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="10" y="20" width="16" height="3" fill="#78350f"/><rect x="16" y="19.5" width="4" height="4" fill="#facc15"/></svg>`;
    case 'legs':
      return `<svg viewBox="0 0 36 36"><path d="M10 6 L26 6 L28 30 L21 30 L18 15 L15 30 L8 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="10" y="6" width="16" height="4" fill="${c2}"/></svg>`;
    case 'tassets':
      return `<svg viewBox="0 0 36 36"><path d="M9 6 L27 6 L29 22 L24 29 L20 16 L16 29 L11 29 L7 22 Z" fill="${c1}" stroke="${c2}" stroke-width="1.6"/><rect x="9" y="6" width="18" height="4.5" fill="${c2}"/><line x1="14" y1="10" x2="13" y2="25" stroke="${c2}" stroke-width="1.4"/><line x1="22" y1="10" x2="23" y2="25" stroke="${c2}" stroke-width="1.4"/></svg>`;
    case 'robe_bottom':
      return `<svg viewBox="0 0 36 36"><path d="M11 6 L25 6 L30 30 L6 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="11" y="6" width="14" height="3.5" fill="${c2}"/><path d="M8 26 L28 26" stroke="${c2}" stroke-width="2"/><line x1="18" y1="9.5" x2="18" y2="30" stroke="${c2}" stroke-width="1.3"/></svg>`;
    case 'dhide_chaps':
      return `<svg viewBox="0 0 36 36"><path d="M10 6 L26 6 L28 30 L21 30 L18 14 L15 30 L8 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="10" y="6" width="16" height="3.5" fill="#78350f"/><circle cx="13" cy="18" r="1.6" fill="${c2}"/><circle cx="23" cy="18" r="1.6" fill="${c2}"/></svg>`;
    case 'trousers':
      return `<svg viewBox="0 0 36 36"><path d="M11 6 L25 6 L27 30 L20 30 L18 15 L16 30 L9 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.4"/><rect x="11" y="6" width="14" height="3" fill="#5c3a21"/><line x1="10" y1="24" x2="16" y2="24" stroke="${c2}" stroke-width="2"/><line x1="20" y1="24" x2="26" y2="24" stroke="${c2}" stroke-width="2"/></svg>`;
    case 'shield':
      return `<svg viewBox="0 0 36 36"><path d="M18 4 L29 8 L27 21 C25 27 18 32 18 32 C18 32 11 27 9 21 L7 8 Z" fill="${c1}" stroke="${c2}" stroke-width="2"/><polygon points="18,9 23,18 18,26 13,18" fill="${c2}" opacity="0.85"/></svg>`;
    case 'defender':
      return `<svg viewBox="0 0 36 36"><polygon points="18,3 23,14 29,16 22,20 18,33 14,20 7,16 13,14" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><circle cx="18" cy="17" r="2.5" fill="#fff"/></svg>`;
    case 'feet':
      return `<svg viewBox="0 0 36 36"><path d="M11 8 L19 8 L19 21 L28 24 L28 29 L9 29 L9 22 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><rect x="9" y="27" width="19" height="3" fill="#27272a"/></svg>`;
    case 'hands':
      return `<svg viewBox="0 0 36 36"><path d="M11 14 C11 9 23 9 23 14 L25 20 L22 29 L10 29 L9 19 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><line x1="10" y1="25" x2="23" y2="25" stroke="${c2}" stroke-width="2"/></svg>`;
    case 'cape':
      return `<svg viewBox="0 0 36 36"><path d="M12 5 L24 5 L29 30 C22 28 14 28 7 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.6"/><path d="M12 5 Q18 10 24 5" fill="none" stroke="#fde047" stroke-width="2"/></svg>`;
    case 'neck':
      return `<svg viewBox="0 0 36 36"><path d="M9 10 C9 23 27 23 27 10" fill="none" stroke="#eab308" stroke-width="2"/><polygon points="18,17 24,24 18,31 12,24" fill="${c1}" stroke="#fef08a" stroke-width="1.5"/></svg>`;
    case 'ring':
      return `<svg viewBox="0 0 36 36"><circle cx="18" cy="20" r="8" fill="none" stroke="#facc15" stroke-width="3.2"/><polygon points="18,6 23,11 18,15 13,11" fill="${c1}" stroke="#fff" stroke-width="1"/></svg>`;
    case 'potion':
      return `<svg viewBox="0 0 36 36"><rect x="15" y="4" width="6" height="5" fill="#a16207"/><path d="M14 9 L22 9 L28 22 C29 27 25 31 18 31 C11 31 7 27 8 22 Z" fill="rgba(226,232,240,0.25)" stroke="#cbd5e1" stroke-width="1.5"/><path d="M9 21 L27 21 C28 26 24 30 18 30 C12 30 8 26 9 21 Z" fill="${c1}"/></svg>`;
    case 'fish':
      return `<svg viewBox="0 0 36 36"><path d="M5 18 C11 9 22 9 29 18 C22 27 11 27 5 18 Z" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><polygon points="28,18 34,12 33,24" fill="${c1}"/><circle cx="11" cy="16" r="1.6" fill="#0f172a"/></svg>`;
    case 'meat':
      return `<svg viewBox="0 0 36 36"><ellipse cx="16" cy="18" rx="10" ry="7.5" transform="rotate(-20 16 18)" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><line x1="24" y1="15" x2="31" y2="12" stroke="#f8fafc" stroke-width="3.5" stroke-linecap="round"/><circle cx="31" cy="11" r="2.5" fill="#f8fafc"/></svg>`;
    case 'stew':
      return `<svg viewBox="0 0 36 36"><path d="M6 17 L30 17 C29 26 24 30 18 30 C12 30 7 26 6 17 Z" fill="#78350f" stroke="#d97706" stroke-width="1.6"/><ellipse cx="18" cy="17" rx="11" ry="4" fill="${c1}"/></svg>`;
    case 'logs':
      return `<svg viewBox="0 0 36 36"><rect x="6" y="12" width="24" height="12" rx="4" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><ellipse cx="10" cy="18" rx="3" ry="5.5" fill="#fde68a"/><line x1="15" y1="15" x2="26" y2="15" stroke="${c2}" stroke-width="1.3"/></svg>`;
    case 'ore':
      return `<svg viewBox="0 0 36 36"><polygon points="8,26 6,15 15,7 27,9 30,21 22,29" fill="#475569" stroke="#94a3b8" stroke-width="1.3"/><polygon points="12,16 17,11 21,16 16,20" fill="${c1}"/><polygon points="20,21 25,17 26,23 21,25" fill="${c1}"/><polygon points="10,22 14,19 16,24 11,25" fill="${c2}"/></svg>`;
    case 'bar':
      return `<svg viewBox="0 0 36 36"><polygon points="6,23 11,13 29,13 24,23" fill="${c1}" stroke="${c2}" stroke-width="1.5"/><polygon points="6,23 24,23 26,27 8,27" fill="${c2}"/></svg>`;
    case 'bones':
      return `<svg viewBox="0 0 36 36"><line x1="9" y1="27" x2="27" y2="9" stroke="${c1}" stroke-width="4.5" stroke-linecap="round"/><circle cx="8" cy="25" r="3" fill="${c1}"/><circle cx="11" cy="28" r="3" fill="${c1}"/><circle cx="25" cy="8" r="3" fill="${c1}"/><circle cx="28" cy="11" r="3" fill="${c1}"/></svg>`;
    case 'rune':
      return `<svg viewBox="0 0 36 36"><ellipse cx="18" cy="18" rx="12" ry="11" fill="#cbd5e1" stroke="#64748b" stroke-width="1.8"/><circle cx="18" cy="18" r="6.5" fill="${c1}"/></svg>`;
    case 'arrow':
      return `<svg viewBox="0 0 36 36"><line x1="4" y1="30" x2="28" y2="6" stroke="${c2}" stroke-width="2.4"/><polygon points="30,4 22,8 26,12" fill="${c1}"/></svg>`;
    case 'bolts':
      return `<svg viewBox="0 0 36 36"><line x1="6" y1="18" x2="30" y2="18" stroke="${c2}" stroke-width="2.4"/><polygon points="30,18 24,14 24,22" fill="${c1}"/></svg>`;
    case 'feather':
      return `<svg viewBox="0 0 36 36"><path d="M8 28 C14 16 22 8 30 6 C22 14 16 22 12 30 Z" fill="${c1}" stroke="${c2}" stroke-width="1.4"/></svg>`;
    default:
      return `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="10" fill="${c1}" stroke="${c2}" stroke-width="2"/></svg>`;
  }
}

export function getPrayerSvg(prayerId) {
  switch (prayerId) {
    case 'thick_skin':
      return `<svg viewBox="0 0 32 32"><polygon points="16,4 27,10 24,25 16,29 8,25 5,10" fill="#64748b" stroke="#cbd5e1" stroke-width="1.8"/></svg>`;
    case 'burst_str':
      return getSkillSvg('strength');
    case 'sharp_eye':
      return getSkillSvg('ranged');
    case 'mystic_might':
      return getSkillSvg('magic');
    case 'prot_magic':
      return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="rgba(59,130,246,0.3)" stroke="#38bdf8" stroke-width="2"/><polygon points="16,6 24,22 8,22" fill="#60a5fa"/><circle cx="16" cy="17" r="3.5" fill="#fde047"/></svg>`;
    case 'prot_ranged':
      return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="rgba(34,197,94,0.3)" stroke="#4ade80" stroke-width="2"/><line x1="7" y1="25" x2="25" y2="7" stroke="#4ade80" stroke-width="3"/><polygon points="26,6 18,8 24,14" fill="#bbf7d0"/></svg>`;
    case 'prot_melee':
      return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="rgba(239,68,68,0.28)" stroke="#f87171" stroke-width="2"/><path d="M9 24 L23 8" stroke="#fca5a5" stroke-width="3.5" stroke-linecap="round"/><path d="M8 19 L14 25" stroke="#facc15" stroke-width="2.5"/></svg>`;
    case 'piety':
      return `<svg viewBox="0 0 32 32"><polygon points="16,2 20,12 30,16 20,20 16,30 12,20 2,16 12,12" fill="#facc15" stroke="#fff" stroke-width="1.5"/><circle cx="16" cy="16" r="5" fill="#38bdf8"/></svg>`;
    default:
      return getUiSvg('prayer');
  }
}

export function getSpellSvg(spell) {
  const c = hexToCss(spell.color || 0x38bdf8);
  if (spell.type === 'teleport') {
    return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="4 2"/><polygon points="16,6 22,18 16,15 10,18" fill="${c}"/><circle cx="16" cy="22" r="2.5" fill="#fff"/></svg>`;
  }
  return `<svg viewBox="0 0 32 32"><path d="M16 3 C23 10 26 17 23 24 C20 28 12 28 9 24 C6 17 9 10 16 3 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/><circle cx="16" cy="19" r="4.5" fill="#fff"/></svg>`;
}

// ============================================================================
