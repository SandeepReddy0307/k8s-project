require('../../shared/tracing');
const {createApp}=require('../../shared/runtime');const path=require('node:path');const express=require('express');
const {app,start}=createApp('frontend',{publicApp:true});
app.get('/ready',(_req,res)=>res.json({status:'ready'}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'1h',index:false}));
app.get(['/', '/browse', '/my-list'],(_req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
// Operational console is deliberately absent from the public application.
start();
