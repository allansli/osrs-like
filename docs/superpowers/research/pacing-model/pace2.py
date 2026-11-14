"""Independent re-implementation of the Stage 3 pacing model, from the code at a8cad85 and design 4.2.
Written by the critic without seeing the author's script."""
import math, sys

# --- XP table (skills.ts 6-14)
XP = [0, 0]
pts = 0
for lvl in range(1, 99):
    pts += math.floor(lvl + 300 * 2 ** (lvl / 7))
    XP.append(pts // 4)
def lvl_for(xp):
    for l in range(99, 0, -1):
        if xp >= XP[l]:
            return l
    return 1

# --- items needed (catalog.ts)
I = {
 'bronze_scimitar': dict(atk=7, str=6, req=('attack',1), price=45, tier=1),
 'iron_scimitar': dict(atk=12, str=11, req=('attack',5), price=140, tier=5),
 'steel_longsword': dict(atk=17, str=16, req=('attack',10), price=290, tier=10),
 'black_scimitar': dict(atk=21, str=20, req=('attack',15), price=440, tier=15),
 'mith_scimitar': dict(atk=26, str=25, req=('attack',20), price=580, tier=20),
 'addy_scimitar': dict(atk=35, str=34, req=('attack',30), price=1350, tier=30),
 'rune_scimitar': dict(atk=47, str=46, req=('attack',40), price=3900, tier=40),
 'dragon_scimitar': dict(atk=67, str=66, req=('attack',60), price=12000, tier=60),
 'bronze_plate': dict(def_=10, price=85, tier=1, pair='bronze_legs'),
 'bronze_legs': dict(def_=7, price=65, tier=1, pair='bronze_plate'),
 'iron_plate': dict(def_=16, price=220, tier=5, pair='iron_legs'),
 'iron_legs': dict(def_=12, price=175, tier=5, pair='iron_plate'),
 'steel_plate': dict(def_=22, price=460, tier=10, pair='steel_legs'),
 'steel_legs': dict(def_=17, price=360, tier=10, pair='steel_plate'),
 'black_plate': dict(def_=26, str=2, price=640, tier=15, pair='black_legs'),
 'black_legs': dict(def_=20, str=1, price=510, tier=15, pair='black_plate'),
 'mith_plate': dict(def_=32, price=850, tier=20, pair='mith_legs'),
 'mith_legs': dict(def_=24, price=680, tier=20, pair='mith_plate'),
 'addy_plate': dict(def_=44, price=2100, tier=30, pair='addy_legs'),
 'addy_legs': dict(def_=33, price=1550, tier=30, pair='addy_plate'),
 'rune_plate': dict(def_=58, price=5200, tier=40, pair='rune_legs'),
 'rune_legs': dict(def_=44, price=3800, tier=40, pair='rune_plate'),
 'dragon_chain': dict(def_=72, str=5, price=14500, tier=60, pair='dragon_legs'),
 'dragon_legs': dict(def_=56, str=4, price=11500, tier=60, pair='dragon_chain'),
}
TIERS = [1, 5, 10, 15, 20, 30, 40, 60]
TNAME = ['bronze','iron','steel','black','mithril','adamant','rune','dragon']
WEAP = {1:'bronze_scimitar',5:'iron_scimitar',10:'steel_longsword',15:'black_scimitar',20:'mith_scimitar',30:'addy_scimitar',40:'rune_scimitar',60:'dragon_scimitar'}
BODY = {1:'bronze_plate',5:'iron_plate',10:'steel_plate',15:'black_plate',20:'mith_plate',30:'addy_plate',40:'rune_plate',60:'dragon_chain'}
LEGS = {1:'bronze_legs',5:'iron_legs',10:'steel_legs',15:'black_legs',20:'mith_legs',30:'addy_legs',40:'rune_legs',60:'dragon_legs'}
SELL = {  # unitSellPrice floor(price*0.65) of drop-only items
 'mystic_top': 1170, 'mystic_bottom': 910, 'shortbow': 61, 'willow_bow': 292, 'green_dhide_body': 715,
 'green_dhide_chaps': 552, 'bandos_chest': 16900, 'bandos_tassets': 14300, 'champion_tunic': 12350, 'champion_leggings': 10075}
def sell(i):
    return SELL[i] if i in SELL else math.floor(I[i]['price'] * 0.65)
FOODHEAL = {'cooked_chicken': 5, 'shrimp': 4, 'trout': 9, 'lobster': 16, 'shark': 24}

# --- monsters (catalog.ts 439-480, world.ts 36-79); n = instances on main (placements.ts)
M = {
 'chicken': dict(lvl=1, hp=4, maxHit=1, atk=1, def_=1, n=4, drops=[('food','cooked_chicken',0.6),('gp',(6,18),0.85)]),
 'goblin': dict(lvl=2, hp=8, maxHit=2, atk=3, def_=2, n=5, drops=[('gp',(12,36),0.9),('gear','iron_plate',0.16),('gear','iron_legs',0.16),('food','shrimp',0.35)]),
 'goblin_archer': dict(lvl=5, hp=12, maxHit=3, atk=8, def_=3, n=2, drops=[('gp',(8,24),0.8),('gear','shortbow',0.08)]),
 'scorpion': dict(lvl=12, hp=22, maxHit=5, atk=12, def_=10, n=5, drops=[('gp',(40,95),0.95),('gear','steel_plate',0.22),('gear','steel_legs',0.22),('food','trout',0.4)]),
 'dark_wizard': dict(lvl=18, hp=30, maxHit=7, atk=18, def_=14, n=3, drops=[('gp',(65,160),0.95),('gear','mystic_top',0.2),('gear','mystic_bottom',0.2),('gear','mith_scimitar',0.18)]),
 'dark_ranger': dict(lvl=24, hp=36, maxHit=9, atk=28, def_=14, n=2, drops=[('gp',(40,120),0.95),('gear','willow_bow',0.16),('gear','green_dhide_body',0.08)]),
 'hill_giant': dict(lvl=28, hp=48, maxHit=10, atk=26, def_=22, n=4, drops=[('gp',(110,260),0.95),('gear','addy_plate',0.22),('gear','addy_legs',0.22),('food','lobster',0.45)]),
 'moss_guardian': dict(lvl=45, hp=78, maxHit=15, atk=42, def_=38, n=4, drops=[('gp',(200,500),1.0),('gear','rune_plate',0.22),('gear','rune_legs',0.22),('gear','green_dhide_body',0.24),('gear','green_dhide_chaps',0.24)]),
 'lesser_demon': dict(lvl=68, hp=125, maxHit=22, atk=64, def_=55, n=4, drops=[('gp',(450,980),1.0),('gear','dragon_chain',0.2),('gear','dragon_legs',0.2),('gear','dragon_scimitar',0.18),('food','shark',0.65)]),
 'elvarg_dragon': dict(lvl=95, hp=260, maxHit=32, atk=88, def_=78, n=1, drops=[('gp',(1800,3800),1.0),('gear','bandos_chest',0.35),('gear','bandos_tassets',0.35),('gear','champion_tunic',0.35),('gear','champion_leggings',0.35)]),
}
STAGE2_ATTACKERS = {'scorpion':3,'dark_wizard':3,'dark_ranger':2,'hill_giant':4,'moss_guardian':2,'lesser_demon':2,'elvarg_dragon':1}

def avg_dmg(M_):
    return (1 + M_ * (M_ + 1) / 2) / (M_ + 1)

class Hero:
    def __init__(s, today):
        s.xp = {'attack':0,'strength':0,'defence':0,'hitpoints':1154,'prayer':0}
        s.eq = {'weapon':'bronze_scimitar','body':None,'legs':None}
        s.today = today
        if today:
            s.eq['body']='bronze_plate'; s.eq['legs']='bronze_legs'
    def L(s,k): return lvl_for(s.xp[k])
    def combat(s):
        base = 0.25*(s.L('defence')+s.L('hitpoints')+s.L('prayer')//2)
        mel = 0.325*(s.L('attack')+s.L('strength'))
        return max(3, math.floor(base+max(mel, 0.325*1, 0.325*1)))
    def bonuses(s):
        atk=str_=def_=0
        if s.today:  # starter extras worn: bronze helm 5, wooden shield 6, hylian cape def5 atk2, gloves 3, boots 3
            atk += 2; def_ += 5+6+5+3+3
        for slot,it in s.eq.items():
            if it:
                d=I[it]; atk+=d.get('atk',0); str_+=d.get('str',0); def_+=d.get('def_',0)
        b, l = s.eq['body'], s.eq['legs']
        if b and l and I[b]['pair']==l:
            atk=math.ceil(atk*1.1); str_=math.ceil(str_*1.1); def_=math.ceil(def_*1.1)
        return atk,str_,def_

def fight(h, mk, stage2):
    m = M[mk]
    atk, strb, defb = h.bonuses()
    maxHit = max(2, math.floor(1.5 + (h.L('strength')+1)*0.32 + strb*0.22))
    acc = (h.L('attack')+2)*1.35 + atk + 12
    hc = min(0.94, max(0.22, acc/(acc + (m['def_']*1.1+4)*0.75)))
    kill = m['hp'] / (hc*avg_dmg(maxHit)) * 0.6
    pdef = (h.L('defence')*1.2 + defb) + 10
    ma = m['atk']*1.25+8
    mhc = min(0.82, max(0.12, ma/(ma+pdef)))
    attackers = 1
    if stage2 and mk in STAGE2_ATTACKERS and m['lvl'] >= h.combat():
        attackers = STAGE2_ATTACKERS[mk]
    dmg_taken = attackers * (kill/1.65) * mhc * avg_dmg(m['maxHit'])
    maxhp = h.L('hitpoints')
    win = dmg_taken <= 0.6*maxhp and attackers*m['maxHit'] < maxhp
    cycle = max(kill+1.5, (8.35+kill)/m['n'])
    food = sum(c*FOODHEAL[i] for k,i,c in m['drops'] if k=='food')
    rest = max(0.0, dmg_taken - 0.25*cycle - food)/0.25
    return win, cycle+rest, kill

def simulate(today, mult, stage2, markup, dropscale, use_drops, quests, cap_h=12, greedy=False):
    h = Hero(today)
    gp = 500 if today else 25
    t = 0.0
    kit = {}; gate = {}
    obtained = {}  # expected-count accumulators for kit pieces
    owned = set(h.eq.values()) - {None}
    last = None
    did_quests = not quests
    def record():
        tw = min(I[h.eq['weapon']]['tier'] if h.eq['weapon'] else 0,
                 I[h.eq['body']]['tier'] if h.eq['body'] else 0,
                 I[h.eq['legs']]['tier'] if h.eq['legs'] else 0)
        for T in TIERS:
            if T <= tw and T not in kit: kit[T] = t
        for T in TIERS:
            if T not in gate and h.L('attack') >= T and h.L('defence') >= T: gate[T] = t
    def upgrade():
        nonlocal gp, t
        for slot, table, skill in (('weapon',WEAP,'attack'),('body',BODY,'defence'),('legs',LEGS,'defence')):
            best = max(T for T in TIERS if T <= h.L(skill))
            cur = I[h.eq[slot]]['tier'] if h.eq[slot] else 0
            if best <= cur: continue
            # owned (dropped) pieces first: best owned that is wearable and better
            cands = [T for T in TIERS if cur < T <= h.L(skill) and table[T] in owned]
            want = table[best]
            if want in owned:
                h.eq[slot] = want; continue
            if greedy:
                aff=[T for T in TIERS if cur < T <= h.L(skill) and (table[T] in owned or gp >= I[table[T]]['price']*markup)]
                if not aff: continue
                want=table[max(aff)]
                if want in owned: h.eq[slot]=want; continue
            price = I[want]['price'] * markup
            if gp >= price:
                gp -= price; t += 40; h.eq[slot] = want; owned.add(want)
            elif cands:
                h.eq[slot] = table[max(cands)]
    record(); upgrade(); record()
    while t < cap_h*3600 and 60 not in kit:
        best = None
        for mk in M:
            win, tpk, kill = fight(h, mk, stage2)
            if not win: continue
            rate = M[mk]['hp']/tpk
            if best is None or rate > best[0]: best = (rate, mk, tpk)
        _, mk, tpk = best
        if mk != last:
            if last is not None: t += 30
            last = mk
        t += tpk
        m = M[mk]
        hp = m['hp']*mult
        h.xp['attack'] += 1.4*hp; h.xp['strength'] += 1.3*hp; h.xp['defence'] += 1.3*hp; h.xp['hitpoints'] += 1.5*hp
        for k, i, c in m['drops']:
            if k == 'gp': gp += c*(i[0]+i[1])/2
            elif k == 'gear':
                c2 = c*dropscale
                if not use_drops: continue
                if i in I and i not in owned:
                    obtained[i] = obtained.get(i,0)+c2
                    if obtained[i] >= 1: owned.add(i); gp += (obtained[i]-1)*sell(i)
                else:
                    gp += c2*sell(i)
        if not did_quests and mk == 'goblin':
            did_quests = True; gp += 1300; t += 180
            h.xp['attack'] += 250; h.xp['hitpoints'] += 250
        record(); upgrade(); record()
    return kit, gate

def fmt(s):
    if s is None: return '-'
    return f'{s/60:.0f} m' if s < 5400 else f'{s/3600:.1f} h'

if __name__ == '__main__':
    rows = [
     ('T2 today, main, no slayer, 10x', dict(today=True, mult=10, stage2=False, markup=1, dropscale=1, use_drops=True, quests=False)),
     ('T2 today, main, no slayer, 1x',  dict(today=True, mult=1,  stage2=False, markup=1, dropscale=1, use_drops=True, quests=False)),
     ('T4 today+S2, no slayer, 10x',    dict(today=True, mult=10, stage2=True,  markup=1, dropscale=1, use_drops=True, quests=False)),
     ('T4 today+S2, no slayer, 1x',     dict(today=True, mult=1,  stage2=True,  markup=1, dropscale=1, use_drops=True, quests=False)),
     ('A1 after, shop only, 1x',        dict(today=False, mult=1, stage2=True,  markup=10, dropscale=0.05, use_drops=False, quests=True)),
     ('A1 after, shop only, 1x, markup 1 (new start + 1x only)', dict(today=False, mult=1, stage2=True, markup=1, dropscale=0.05, use_drops=False, quests=True)),
     ('new start, today economy (drops x1, markup 1), S2, 1x', dict(today=False, mult=1, stage2=True, markup=1, dropscale=1, use_drops=True, quests=True)),
     ('A1-like but drops on (x0.05), 1x', dict(today=False, mult=1, stage2=True, markup=10, dropscale=0.05, use_drops=True, quests=True)),
     ('A1 at 10x', dict(today=False, mult=10, stage2=True, markup=10, dropscale=0.05, use_drops=False, quests=True)),
    ]
    rows += [(n+' GREEDY', dict(o, greedy=True)) for n,o in rows]
    for name, o in rows:
        kit, gate = simulate(**o)
        print(f'{name:58s} kit  ' + ' | '.join(f'{TNAME[i]} {fmt(kit.get(T))}' for i,T in enumerate(TIERS)))
        print(f'{"":58s} gate ' + ' | '.join(f'{TNAME[i]} {fmt(gate.get(T))}' for i,T in enumerate(TIERS)))
