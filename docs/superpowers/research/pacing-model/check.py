import tasks as t, pace2 as p, math
T=t.TIERS; N=t.TNAME
def summary(label, **o):
    kit,gate=t.simulate(**o)
    out=[]
    for i in range(1,7):
        k,g=kit[T[i]],gate[T[i]]
        price=sum(p.I[x[T[i]]]['price'] for x in (t.WEAP,t.BODY,t.LEGS))*o.get('markup',10)
        lag=sum(1 for j in range(i+1,8) if gate[T[j]]['nk']<k['nk'])
        out.append(f"{N[i]}: gate {g['nk']} ({g['t']/60:.0f}m) kit {k['nk']} ({k['t']/60:.0f}m) +{k['nk']-g['nk']} share {sum(g['earned'].values())/price:.2f} lag {lag}")
    print(label,'|',' ; '.join(out), '| dragon', kit[60]['nk'], f"{kit[60]['t']/3600:.1f}h", 'strict', all(kit[T[i]]['nk']<kit[T[i+1]]['nk'] for i in range(1,7)))
summary('A1')
summary('A3',use_drops=True,slayer=True)
summary('A1 drops on',use_drops=True)
for mk in (8,9,11,12): summary(f'A1 m{mk}',markup=mk)
for mk in (8,12): summary(f'A3 m{mk}',markup=mk,use_drops=True,slayer=True)
summary('CTRL',markup=1,dropscale=1,use_drops=True)
summary('CTRL slayer',markup=1,dropscale=1,use_drops=True,slayer=True,bounty_div=1)
p.STAGE2_ATTACKERS.update({'scorpion':3,'moss_guardian':2,'lesser_demon':2})
summary('A1 attackers 3/3/2/4/2/2')
summary('A3 attackers 3/3/2/4/2/2',use_drops=True,slayer=True)

summary('A1 10x',mult=10)
summary('A3 10x',mult=10,use_drops=True,slayer=True)
