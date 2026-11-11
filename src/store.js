import pg from 'pg';
const {Pool}=pg;
let pool;
let local = null;
const localDaily=new Map();
export async function initializeStore(){
 if(process.env.DATABASE_URL){
  pool=new Pool({connectionString:process.env.DATABASE_URL, max:4, ssl:process.env.DB_SSL==='require'?{rejectUnauthorized:true}:undefined});
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_games (
   id UUID PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_ai_daily_quota (
    day DATE PRIMARY KEY, used INTEGER NOT NULL CHECK (used >= 0)
  )`);
 }else if(process.env.NODE_ENV==='production'){
  throw Error('DATABASE_URL is mandatory in production');
 }else console.warn('DEVELOPMENT ONLY: no DATABASE_URL; games disappear on restart');
}
export async function getGame(){
 if(!pool)return structuredClone(local);
 const {rows}=await pool.query('SELECT state FROM avalon_games ORDER BY updated_at DESC LIMIT 1');
 return rows[0]?.state??null;
}
export async function saveNewGame(g){
 if(!pool){local=structuredClone(g);return;}
 await pool.query('INSERT INTO avalon_games (id,state) VALUES ($1,$2::jsonb)',[g.id,JSON.stringify(g)]);
}
export async function mutateGame(expectedRevision, fn){
 if(!pool){if(!local)throw Error('start a game');if(local.revision!==expectedRevision)throw Error('stale state; refresh');let g=structuredClone(local);await fn(g);local=g;return g;}
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT id,state FROM avalon_games ORDER BY updated_at DESC LIMIT 1 FOR UPDATE');
  if(!rows.length)throw Error('start a game');
  const g=rows[0].state;
  if(g.revision!==expectedRevision)throw Error('stale state; refresh');
  await fn(g);
  await client.query('UPDATE avalon_games SET state=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify(g),rows[0].id]);
  await client.query('COMMIT');return g;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function closeStore(){await pool?.end();}

// Atomic reservation across Railway restarts and simultaneous requests.
// YYYY-MM-DD uses UTC consistently, independently of player's device clock.
export async function reserveDailyCall(limit){
 const day=new Date().toISOString().slice(0,10);
 if(!pool){
  const current=localDaily.get(day)||0;
  if(current>=limit)return false;
  localDaily.set(day,current+1);return true;
 }
 const {rows}=await pool.query(`
  INSERT INTO avalon_ai_daily_quota(day,used) VALUES ($1,1)
  ON CONFLICT(day) DO UPDATE SET used=avalon_ai_daily_quota.used+1
    WHERE avalon_ai_daily_quota.used < $2
  RETURNING used
 `,[day,limit]);
 return rows.length===1;
}
