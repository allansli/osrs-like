"""Task-count version of the critic's model (pace2.py). Counts kills, gold and actions at each gate and kit.
New start: nothing in hand; starter chain gives scimitar (quest 1), bronze legs+body are forged in quest 4,
25 GP at quest 6. Slayer per design 4.2 (optional)."""
import math, sys
import pace2 as p
I, M, TIERS, TNAME, WEAP, BODY, LEGS = p.I, p.M, p.TIERS, p.TNAME, p.WEAP, p.BODY, p.LEGS
BANDS = [('goblin',6,3,15,400,80,12),('scorpion',5,10,22,900,160,20),('dark_wizard',5,16,30,1200,220,28),
         ('hill_giant',5,24,42,1800,320,36),('moss_guardian',4,40,60,3200,480,48),('lesser_demon',4,55,99,5500,700,64)]
def pick_band(c):
    el=[b for b in BANDS if c>=b[2]]
    if not el: return None
    cov=[b for b in el if c<=b[3]]
    pool=cov if cov else [el[-1]]
    return max(pool,key=lambda b:b[2])
ATT = {'scorpion':5,'dark_wizard':3,'dark_ranger':2,'hill_giant':4,'moss_guardian':4,'lesser_demon':4,'elvarg_dragon':1}
p.STAGE2_ATTACKERS.update(ATT)

def simulate(mult=1, markup=10, dropscale=0.05, use_drops=False, slayer=False, bounty_div=3, chain=True, cap_h=14):
    h = p.Hero(False)
    gp = 0.0; t = 0.0
    kills = {}; nk = 0
    earned = dict(coins=0.0, gear=0.0, slayer=0.0, quests=0.0); spent = 0.0
    kit = {}; gate = {}
    obtained = {}; owned = {'bronze_scimitar'}
    task = [BANDS[0], 6] if chain else None  # quest 1 of the chain hands out one goblin task
    snap = lambda: dict(t=t, kills=dict(kills), nk=nk, earned=dict(earned), spent=spent, gp=gp)
    def record():
        tw = min(I[h.eq[s]]['tier'] if h.eq[s] else 0 for s in ('weapon','body','legs'))
        for T in TIERS:
            if T <= tw and T not in kit: kit[T] = snap()
            if T not in gate and h.L('attack') >= T and h.L('defence') >= T: gate[T] = snap()
    def upgrade():
        nonlocal gp, t, spent
        for slot, table, skill in (('weapon',WEAP,'attack'),('body',BODY,'defence'),('legs',LEGS,'defence')):
            cur = I[h.eq[slot]]['tier'] if h.eq[slot] else 0
            aff=[T for T in TIERS if cur < T <= h.L(skill) and (table[T] in owned or gp >= I[table[T]]['price']*markup)]
            if not aff: continue
            want=table[max(aff)]
            if want not in owned:
                gp -= I[want]['price']*markup; spent += I[want]['price']*markup; t += 40; owned.add(want)
            h.eq[slot]=want
    # starter chain: scimitar at once; legs+body forged, 25 GP; 6 quests x 90 s, one goblin kill inside
    chain_done = not chain
    if not chain:
        h.eq['body']='bronze_plate'; h.eq['legs']='bronze_legs'
    did_quests = False
    last = None
    record()
    while t < cap_h*3600 and 60 not in kit:
        best = None
        for mk in M:
            win, tpk, kill = p.fight(h, mk, True)
            if not win: continue
            rate = M[mk]['hp']/tpk
            if best is None or rate > best[0]: best = (rate, mk, tpk)
        _, mk, tpk = best
        if not chain_done: mk='goblin'; tpk=p.fight(h,'goblin',True)[1]
        if mk != last:
            if last is not None: t += 30
            last = mk
        if slayer and task is None:
            b = pick_band(h.combat())
            if b: task=[b,b[1]]; t+=10
        t += tpk; nk += 1; kills[mk]=kills.get(mk,0)+1
        m = M[mk]; hp = m['hp']*mult
        h.xp['attack'] += 1.4*hp; h.xp['strength'] += 1.3*hp; h.xp['defence'] += 1.3*hp; h.xp['hitpoints'] += 1.5*hp
        for k, i, c in m['drops']:
            if k == 'gp': g=c*(i[0]+i[1])/2; gp+=g; earned['coins']+=g
            elif k == 'gear' and use_drops:
                c2 = c*(dropscale if mk!='elvarg_dragon' else (0.05/0.35 if dropscale<1 else 1))
                if i in I and i not in owned:
                    obtained[i] = obtained.get(i,0)+c2
                    if obtained[i] >= 1: owned.add(i)
                else:
                    g=c2*p.sell(i); gp += g; earned['gear']+=g
        if task and task[0][0]==mk:
            b=task[0]; h.xp['attack']+=b[6]; task[1]-=1
            if task[1]<=0:
                bg = b[4] if (b[0]=='goblin' or bounty_div==1) else round(b[4]/bounty_div, -2)
                gp+=bg; earned['slayer']+=bg; h.xp['attack']+=b[5]; task=None
        if not chain_done:
            chain_done=True; t += 6*90; gp += 25; earned['quests']+=25
            owned.update(['bronze_plate','bronze_legs']); h.eq['body']='bronze_plate'; h.eq['legs']='bronze_legs'
        elif not did_quests and mk=='goblin':
            did_quests=True; gp+=1300; earned['quests']+=1300; t+=180; h.xp['attack']+=250; h.xp['hitpoints']+=250
        record(); upgrade(); record()
    return kit, gate

def show(label, **o):
    kit, gate = simulate(**o)
    print('\n==', label)
    for i,T in enumerate(TIERS):
        if T not in kit or T not in gate: print(TNAME[i],'not reached'); continue
        k,g = kit[T],gate[T]
        tot=sum(k['earned'].values())
        print(f"{TNAME[i]:8s} gate: {g['nk']:5d} kills ({g['t']/60:6.1f} m)  kit: {k['nk']:5d} kills ({k['t']/60:6.1f} m)  extra {k['nk']-g['nk']:5d}  earned@gate {sum(g['earned'].values()):9.0f} earned@kit {tot:9.0f} spent {k['spent']:8.0f}  kills {k['kills']}")
    return kit, gate
if __name__=='__main__':
    show('A1 shop only 1x markup10')
    show('A3 shop+drops+slayer 1x', use_drops=True, slayer=True)
    show('CONTROL today economy no slayer', markup=1, dropscale=1, use_drops=True)
    show('CONTROL today economy slayer', markup=1, dropscale=1, use_drops=True, slayer=True, bounty_div=1)
    for mk in (8,12): show(f'A1 markup {mk}', markup=mk)
    show('A1 10x', mult=10)
