"""Classify v16 quarter-step source selection from numerical hardware markers.
Usage: v16-calibration.json output.json. No audio dependencies.
"""
import json,sys
from pathlib import Path
x=json.loads(Path(sys.argv[1]).read_text());rows=[];pairs={}
for q in x['loopWindows']:
 markers=q['markers'];first=markers[0]['slice'];ids=[]
 for i in range(4):
  target=.012+i*.25;m=min(markers,key=lambda m:abs(m['time']-target));ids.append(m['slice'] if abs(m['time']-target)<.04 else None)
 mismatch=next((i for i in range(1,4) if ids[i]!=first+i),None)
 absorbing=mismatch is None or all(ids[i]==first for i in range(mismatch,4))
 row={'cycle':q['cycle'],'pattern':q['pattern'],'start':q['start'],'quarterSourceIDs':ids,'firstRetainedOriginTick':mismatch,'retainedOriginPersists':absorbing};rows.append(row);pairs.setdefault((q['pattern'],q['start']),[]).append(row)
variations=[{'pattern':p,'start':t,'pass0':a[0]['quarterSourceIDs'],'pass1':a[1]['quarterSourceIDs']} for (p,t),a in pairs.items() if len(a)==2 and a[0]['quarterSourceIDs']!=a[1]['quarterSourceIDs']]
report={'profile':'loop-reset-order-v16','windows':rows,'pairedWindows':len(pairs),'differentBetweenPasses':len(variations),'variations':variations,'allWindowsRetainOriginAfterFirstOverride':all(a['retainedOriginPersists'] for a in rows),'scope':'Source IDs near four quarter-step boundaries, not microsecond reset order. Supports an ordering/phase hypothesis but does not identify a deterministic timer model; no random scheduling rule added.'}
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n');print({k:report[k] for k in ['pairedWindows','differentBetweenPasses','allWindowsRetainOriginAfterFirstOverride']})
