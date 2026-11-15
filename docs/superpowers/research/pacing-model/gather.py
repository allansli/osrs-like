import math
N={'copper':(1,4.5,2,28,16),'iron':(10,5.5,3,58,42),'mith':(25,7,2,120,115),'gold':(35,8,3,175,185),'runite':(50,11,2,320,620),
 'normal':(1,5,3,25,12),'oak':(10,6.5,2,55,32),'willow':(20,7,2,95,75),'maple':(30,7.5,3,120,110),'yew':(35,8.5,2,175,190),'magic':(50,10,2,310,480)}
F={'shrimp':(1,3,30,12),'trout':(12,1,68,45),'lobster':(28,2,135,130),'shark':(45,2,245,280)}
def rate(r,n,p,pd=1.0):
    return 3600/max(0.6/p+pd*1.0,(pd*r+0.6/p)/n)
for k,(req,r,n,xp,price) in N.items():
    for d in (0,21):
        p=min(0.92,0.5+0.02*d); it=rate(r,n,p)
        print(f'{k:7s} +{d:2d}: {it:5.0f}/h xp {it*xp/1000:4.0f}k gp {it*math.floor(price*0.65)/1000:4.0f}k')
for k,(req,n,xp,cooked) in F.items():
    for label,(r,pd) in {'today':({'shrimp':2,'trout':2,'lobster':2.5,'shark':3}[k],0.35),'after':({'shrimp':6,'trout':3,'lobster':7,'shark':8}[k],1.0),'alt35':({'shrimp':17,'trout':8.5,'lobster':20,'shark':23}[k],0.35)}.items():
        out=[]
        for d in (0,21):
            p=min(0.92,0.5+0.02*d); it=rate(r,n,p,pd); out.append(f'{it:5.0f}/h gp {it*math.floor(cooked*0.65)/1000:4.0f}k')
        print(f'{k:7s} {label}: '+' .. '.join(out))
