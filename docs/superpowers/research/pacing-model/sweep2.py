import importlib.util
spec=importlib.util.spec_from_file_location('p','pace2.py'); p=importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
WIN={1:(1,8),5:(8,25),10:(15,35),15:(25,50),20:(30,60),30:(50,90),40:(90,150),60:(300,540)}
def run(label, **o):
    kit,gate=p.simulate(**o)
    k=[round(kit[T]/60) for T in p.TIERS]; g=[round(gate[T]/60) for T in p.TIERS]
    waits=[k[i]-g[i] for i in range(1,6)]
    fails=[p.TNAME[i] for i,T in enumerate(p.TIERS) if not (WIN[T][0]<=kit[T]/60<=WIN[T][1])]
    wf=[p.TNAME[i+1] for i,w in enumerate(waits) if not 10<=w<=30]
    print(label,'kit',k,'gate',g,'waits',waits,'win fails',fails,'wait fails',wf)
base=dict(today=False,mult=1,stage2=True,dropscale=0.05,use_drops=False,quests=True,greedy=True)
for mk in (9,11): run(f'greedy markup {mk}', markup=mk, **base)
# camps as on feat/world-place today: all members of a type attack (scorpion 5, guardian 4, demon 4)
p.STAGE2_ATTACKERS.update({'scorpion':5,'moss_guardian':4,'lesser_demon':4})
run('greedy markup 10, attackers 5/3/2/4/4/4', markup=10, **base)
