import json,os,pathlib,yaml,re
expected={'frontend','api-gateway','auth-service','catalog-service','user-service','search-service','recommendation-service','notification-service','billing-service','admin-dashboard','activity-tracker','video-encoder-job'}
digests={}
for path in pathlib.Path('digests').glob('*.json'):digests.update(json.loads(path.read_text()))
if set(digests)!=expected or any(not re.fullmatch(r'sha256:[a-f0-9]{64}',d) for d in digests.values()):raise SystemExit('Incomplete or invalid verified image set')
owner=os.environ['OWNER'].lower();sha=os.environ['RELEASE_SHA']
registry=os.environ.get('REGISTRY','docker.io')
if registry!='docker.io' or not re.fullmatch(r'[a-z0-9][a-z0-9_-]+',owner):raise SystemExit('Invalid Docker Hub registry or namespace')
if not re.fullmatch(r'[a-f0-9]{40}',sha):raise SystemExit('Invalid release SHA')
pathlib.Path('gitops/environments/images.yaml').write_text(yaml.safe_dump({'images':{'registry':registry,'owner':owner,'tag':sha,'digests':digests}},sort_keys=False))
