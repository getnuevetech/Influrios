import json,sys
r=json.load(open(sys.argv[1]))
def pick(d):
    if not d: return None
    o={k:d.get(k) for k in ['homeBanner','homeStat','homeAttention','hubInvitationsCard','hubNoInvitesCopy','bell','inboxOpenTasks','homeActive','hubActive']}
    o['collabBadge']=[v for k,v in d['sidebar'].items() if k and k.startswith('Collaborations')]
    return o
print('error:',(r.get('error') or '')[:400])
for k,v in r.items():
    if isinstance(v,dict) and 'sidebar' in v and 'homeBanner' in v: print(k,pick(v))
    elif k not in ('check','host','startedAt','finishedAt','error'): print(k,v)
