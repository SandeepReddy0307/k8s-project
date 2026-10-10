#!/usr/bin/env python3
"""Offline release gates for code, Helm workload security, references and workflows."""
from pathlib import Path
import subprocess,json,yaml,sys
root=Path(__file__).resolve().parents[2]
def run(*args):return subprocess.check_output(args,cwd=root,text=True,stderr=subprocess.STDOUT)
for f in (root/'app').glob('*/src/*.js'):run('node','--check',str(f))
for f in (root/'app/shared').glob('*.js'):run('node','--check',str(f))
run('node','--check','app/frontend/src/public/app.js')
chart='gitops/charts/streamflix'
run('helm','lint',chart,'--set','images.owner=validation','--set','images.tag=0123456789abcdef')
rendered=run('helm','template','streamflix-v2',chart,'-n','streamflix-v2','--set','images.owner=validation','--set','images.tag=0123456789abcdef')
docs=[d for d in yaml.safe_load_all(rendered) if d]
services={d['metadata']['name'] for d in docs if d['kind']=='Service'}
expected=set(yaml.safe_load((root/chart/'values.yaml').read_text())['services'])
assert expected.issubset(services)
for d in docs:
 if d['kind']=='Deployment':
  spec=d['spec']['template']['spec'];assert spec['securityContext']['runAsNonRoot'];assert spec['securityContext']['seccompProfile']['type']=='RuntimeDefault'
  for c in spec['containers']:
   sc=c['securityContext'];assert sc['readOnlyRootFilesystem'] and not sc['allowPrivilegeEscalation'];assert sc['capabilities']['drop']==['ALL']
   assert all(x in c for x in ['startupProbe','readinessProbe','livenessProbe','resources'])
   assert 'latest' not in c['image']
   for env in c['env']:
    if env['name'] in ['DB_PASSWORD','JWT_PUBLIC_KEY','JWT_PRIVATE_KEY','REDIS_PASSWORD','ES_PASSWORD','PAYMENT_API_KEY']:assert 'secretKeyRef' in env['valueFrom']
private_owners=[d['metadata']['name'] for d in docs if d['kind']=='Deployment' for c in d['spec']['template']['spec']['containers'] for e in c.get('env',[]) if e['name']=='JWT_PRIVATE_KEY']
assert private_owners==['auth-service']
assert len([d for d in docs if d['kind']=='Job'])==4
assert len([d for d in docs if d['kind']=='CronJob'])==3
assert len([d for d in docs if d['kind']=='StatefulSet'])==4
assert len([d for d in docs if d['kind']=='Ingress'])==1
conf=next(d for d in docs if d['kind']=='ConfigMap' and d['metadata']['name']=='streamflix-config')['data']
assert 'streamflix-v2.svc.cluster.local' in conf['AUTH_URL']
prod=subprocess.run(['helm','template','test',chart,'-f','gitops/environments/production.yaml','--set','images.owner=validation','--set','images.tag=0123456789abcdef'],cwd=root,capture_output=True,text=True)
assert prod.returncode!=0 and 'Production requires' in prod.stderr
for f in (root/'.github/workflows').glob('*.yml'):
 yaml.safe_load(f.read_text())
 import re
 for action in re.findall(r'uses: ([^\s#]+)',f.read_text()):assert re.fullmatch(r'[\w.-]+/[\w.-]+@[a-f0-9]{40}',action),action
for f in (root/'scripts/v2').glob('*.sh'):run('bash','-n',str(f))
print(f'PASS: JS syntax, Helm lint, {len(docs)} resources, Secret references, derived DNS, workload security, production fail-closed, workflow YAML, shell syntax')
