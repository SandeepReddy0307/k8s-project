#!/usr/bin/env python3
"""Learning namespace only: generate credentials directly into Kubernetes stdin."""
import argparse, base64, json, secrets, subprocess
p=argparse.ArgumentParser();p.add_argument('--namespace',default='streamflix-v2');args=p.parse_args()
if not args.namespace.endswith('-v2'): raise SystemExit('Learning bootstrap requires a separate -v2 namespace. Production uses External Secrets.')
private_key=subprocess.check_output(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:3072'],stderr=subprocess.DEVNULL).decode()
public_key=subprocess.check_output(['openssl','pkey','-pubout'],input=private_key.encode(),stderr=subprocess.DEVNULL).decode()
items={'streamflix-jwt':{'private-key':private_key,'public-key':public_key},'streamflix-redis':{'password':secrets.token_hex(32)},'streamflix-elastic':{'username':'elastic','password':secrets.token_hex(32)},'streamflix-payment':{'api-key':secrets.token_hex(32)},'streamflix-postgres-admin':{'username':'platform_admin','password':secrets.token_hex(32)}}
for service in ['auth','catalog','user','billing']:items[f'streamflix-{service}-db']={'username':f'{service}_app','password':secrets.token_hex(32)}
for name,data in items.items():
 existing=subprocess.run(['kubectl','get','secret',name,'-n',args.namespace,'--ignore-not-found','-o','name'],capture_output=True,text=True,check=True)
 if existing.stdout.strip():print(f'Preserved {name}');continue
 secret={'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':args.namespace},'type':'Opaque','data':{k:base64.b64encode(v.encode()).decode() for k,v in data.items()}}
 subprocess.run(['kubectl','create','-f','-'],input=json.dumps(secret),text=True,check=True,stdout=subprocess.DEVNULL)
 print(f'Created {name} (values withheld)')
