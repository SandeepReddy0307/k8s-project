#!/usr/bin/env python3
"""Resolve action tags to immutable commit SHAs; source tags remain in comments."""
import json,re,urllib.request
from pathlib import Path
cache={}
def resolve(repository,tag):
 key=(repository,tag)
 if key in cache:return cache[key]
 print(f'Resolving {repository}@{tag}',flush=True)
 url=f'https://api.github.com/repos/{repository}/git/ref/tags/{tag}'
 while True:
  req=urllib.request.Request(url,headers={'User-Agent':'StreamFlix-release-tool','Accept':'application/vnd.github+json'})
  with urllib.request.urlopen(req,timeout=30) as response:obj=json.load(response)
  obj=obj.get('object',obj)
  if obj['type']=='commit':cache[key]=obj['sha'];return obj['sha']
  url=obj['url']
for file in Path('.github/workflows').glob('*.yml'):
 def pin(match):
  repository,tag=match.groups()
  if re.fullmatch('[a-f0-9]{40}',tag):return match.group(0)
  return f'uses: {repository}@{resolve(repository,tag)} # {tag}'
 text=re.sub(r'uses: ([\w.-]+/[\w.-]+)@([\w.-]+)',pin,file.read_text())
 file.write_text(text)
print(f'Pinned {len(cache)} action references to verified GitHub commit SHAs')
