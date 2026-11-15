import importlib.util
spec=importlib.util.spec_from_file_location('p','pace2.py'); p=importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
WIN={1:(1,8),5:(8,25),10:(15,35),15:(25,50),20:(30,60),30:(50,90),40:(90,150),60:(300,540)}
for greedy in (False,True):
  for mk in (6,8,10,12):
    kit,gate=p.simulate(today=False,mult=1,stage2=True,markup=mk,dropscale=0.05,use_drops=False,quests=True,greedy=greedy)
    k=[round(kit[T]/60) for T in p.TIERS]; g=[round(gate[T]/60) for T in p.TIERS]
    waits=[k[i]-g[i] for i in range(1,6)]
    fails=[p.TNAME[i] for i,T in enumerate(p.TIERS) if not (WIN[T][0]<=kit[T]/60<=WIN[T][1])]
    wf=[p.TNAME[i+1] for i,w in enumerate(waits) if not 10<=w<=30]
    print(('greedy' if greedy else 'strict'), mk, 'kit',k,'gate',g,'waits',waits,'window fails',fails,'wait fails',wf)
