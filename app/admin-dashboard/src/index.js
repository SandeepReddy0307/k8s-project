require('../../shared/tracing');
const {createApp,required,requireIdentity}=require('../../shared/runtime');
const {app,start}=createApp('admin-dashboard');let api;
const initialized=import('@kubernetes/client-node').then(k8s=>{const kc=new k8s.KubeConfig();kc.loadFromCluster();api=kc.makeApiClient(k8s.CoreV1Api);});
app.get('/ready',(_req,res)=>res.json({status:'ready'}));
app.get('/pods',requireIdentity,async(req,res)=>{const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase());if(!allowed.includes(req.identity.email))return res.status(403).json({error:'forbidden'});await initialized;const body=await api.listNamespacedPod({namespace:required('NAMESPACE')});res.json(body.items.map(p=>({name:p.metadata.name,phase:p.status.phase,node:p.spec.nodeName})));});start();
