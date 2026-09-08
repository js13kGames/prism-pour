"""Run after every source/asset change, before committing and packaging a release."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]/'dist'
assets={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name not in ['sw.js','version.json']}
version=hashlib.sha256(json.dumps(assets,sort_keys=True).encode()).hexdigest()[:16]
(root/'version.json').write_text(json.dumps({'version':version}))
source='const VERSION='+json.dumps(version)+';\nconst ASSETS='+json.dumps(assets)+';\n'+(Path(__file__).parent/'sw-template.js').read_text()
(root/'sw.js').write_text(source)
print('Prepared PWA release',version,'with',len(assets),'verified offline assets')
