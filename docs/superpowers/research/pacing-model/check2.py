import tasks as t, pace2 as p
T=t.TIERS; N=t.TNAME
def s(label, **o):
    kit,gate=t.simulate(**o)
    fk=[kit[T[i]]['nk']-gate[T[i]]['nk'] for i in range(1,7)]
    lag=[sum(1 for j in range(i+1,8) if gate[T[j]]['nk']<kit[T[i]]['nk']) for i in range(1,7)]
    strict=all(kit[T[i]]['nk']<kit[T[i+1]]['nk'] for i in range(1,7))
    print(f"{label:28s} further {fk} lag {lag} strict {strict} gates {[gate[x]['nk'] for x in T[1:]]} kits {[kit[x]['nk'] for x in T[1:]]}")
for mk in (8,9,10,11,12):
    s(f'A1 10x m{mk}', mult=10, markup=mk)
for mk in (8,9,10,11,12):
    for ds in (0.025,0.05,0.1):
        s(f'A3 1x m{mk} ds{ds}', markup=mk, use_drops=True, slayer=True, dropscale=ds)
