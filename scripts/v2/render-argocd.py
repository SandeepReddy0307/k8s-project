#!/usr/bin/env python3
"""Generate a scoped GitOps application from deployment configuration, not app URLs."""
import argparse,yaml
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--namespace',default='streamflix-v2');p.add_argument('--profile',choices=['learning','production'],default='learning');a=p.parse_args()
project={'apiVersion':'argoproj.io/v1alpha1','kind':'AppProject','metadata':{'name':'streamflix','namespace':'argocd'},'spec':{'sourceRepos':[a.repo],'destinations':[{'server':'https://kubernetes.default.svc','namespace':a.namespace}],'clusterResourceWhitelist':[],'namespaceResourceWhitelist':[{'group':'*','kind':'*'}]}}
app={'apiVersion':'argoproj.io/v1alpha1','kind':'Application','metadata':{'name':'streamflix-v2','namespace':'argocd'},'spec':{'project':'streamflix','source':{'repoURL':a.repo,'targetRevision':'main','path':'gitops/charts/streamflix','helm':{'releaseName':'streamflix-v2','valueFiles':[f'../../environments/{a.profile}.yaml','../../environments/images.yaml']}},'destination':{'server':'https://kubernetes.default.svc','namespace':a.namespace},'syncPolicy':{'automated':{'prune':True,'selfHeal':True},'syncOptions':['ServerSideApply=true']},'ignoreDifferences':[{'group':'apps','kind':'Deployment','jsonPointers':['/spec/replicas']}]}}
print(yaml.safe_dump_all([project,app],sort_keys=False))
