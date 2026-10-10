'use strict';
const fs=require('node:fs');const path=require('node:path');const {database,required}=require('./runtime');
(async()=>{const pool=database();const connection=await pool.connect();try{
 await connection.query('SELECT pg_advisory_lock(734839)');
 await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ DEFAULT now())');
 const folder=path.join(__dirname,'..',required('SERVICE_NAME'),'migrations');
 for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.sql')).sort()){
  const exists=await connection.query('SELECT name FROM schema_migrations WHERE name=$1',[file]);if(exists.rowCount)continue;
  await connection.query('BEGIN');try{await connection.query(fs.readFileSync(path.join(folder,file),'utf8'));await connection.query('INSERT INTO schema_migrations(name) VALUES($1)',[file]);await connection.query('COMMIT');}catch(e){await connection.query('ROLLBACK');throw e;}
 }
}finally{await connection.query('SELECT pg_advisory_unlock(734839)');connection.release();await pool.end();}})().catch(e=>{console.error(JSON.stringify({event:'migration-failed',code:e.code||'configuration-error'}));process.exit(1);});
