import pg from 'pg';
const {Pool}=pg;
let pool;
let local = null;
const localDaily=new Map();
const localGameCalls=new Map();
export async function initializeStore(){
 if(process.env.DATABASE_URL){
  pool=new Pool({connectionString:process.env.DATABASE_URL, max:4, ssl:process.env.DB_SSL==='require'?{rejectUnauthorized:true}:undefined});
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_games (
   id UUID PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_ai_daily_quota (
    day DATE PRIMARY KEY, used INTEGER NOT NULL CHECK (used >= 0)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_ai_game_quota (
    game_id UUID PRIMARY KEY, used INTEGER NOT NULL CHECK (used >= 0)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_ai_seat_quota (game_id UUID NOT NULL, seat INTEGER NOT NULL, used INTEGER NOT NULL CHECK (used>=0), PRIMARY KEY(game_id,seat))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS avalon_ai_provider_daily_quota (day DATE NOT NULL,provider TEXT NOT NULL,used INTEGER NOT NULL CHECK (used>=0),PRIMARY KEY(day,provider))`);
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

// Durable per-game reservation, including attempts rolled back by a failed NPC response.
export async function reserveGameCall(gameId,limit){
 if(!pool){const n=localGameCalls.get(gameId)||0;if(n>=limit)return null;localGameCalls.set(gameId,n+1);return n+1;}
 const {rows}=await pool.query(`INSERT INTO avalon_ai_game_quota(game_id,used) VALUES($1,1)
 ON CONFLICT(game_id) DO UPDATE SET used=avalon_ai_game_quota.used+1
 WHERE avalon_ai_game_quota.used < $2 RETURNING used`,[gameId,limit]);
 return rows[0]?.used??null;
}
export async function getGameUsage(gameId){
 if(!pool)return localGameCalls.get(gameId)||0;
 const {rows}=await pool.query('SELECT used FROM avalon_ai_game_quota WHERE game_id=$1',[gameId]);
 return rows[0]?.used||0;
}

// 2.5 reserves four dimensions atomically. Each selected provider has its OWN
// account-level cap; two OpenRouter models share the same OpenRouter budget.
// PostgreSQL advisory transaction lock serializes reservations across replicas.
const localProviderUsage=new Map(),localSeatUsage=new Map();
export async function reserveScopedCall(gameId,seat,provider,limits){
 const day=new Date().toISOString().slice(0,10);
 const sk=`${gameId}:${seat}`,pk=`${day}:${provider}`;
 const errors={game:'本局模型請求額度已滿',daily:'全站今日模型請求額度已滿',seat:`${seat} 號 NPC 個人額度已滿`,provider:`${provider} 今日保護額度已滿`};
 if(!pool){
  const counts={game:localGameCalls.get(gameId)||0,daily:localDaily.get(day)||0,seat:localSeatUsage.get(sk)||0,provider:localProviderUsage.get(pk)||0};
  for(const key of ['game','daily','seat','provider'])if(counts[key]>=limits[key+'Limit'])return {ok:false,reason:errors[key]};
  localGameCalls.set(gameId,counts.game+1);localDaily.set(day,counts.daily+1);localSeatUsage.set(sk,counts.seat+1);localProviderUsage.set(pk,counts.provider+1);
  return {ok:true,game:counts.game+1};
 }
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(25110001)');
  const [gameResult,dailyResult,seatResult,providerResult]=await Promise.all([
   client.query('SELECT used FROM avalon_ai_game_quota WHERE game_id=$1',[gameId]),
   client.query('SELECT used FROM avalon_ai_daily_quota WHERE day=$1',[day]),
   client.query('SELECT used FROM avalon_ai_seat_quota WHERE game_id=$1 AND seat=$2',[gameId,seat]),
   client.query('SELECT used FROM avalon_ai_provider_daily_quota WHERE day=$1 AND provider=$2',[day,provider])
  ]);
  const counts={game:gameResult.rows[0]?.used||0,daily:dailyResult.rows[0]?.used||0,seat:seatResult.rows[0]?.used||0,provider:providerResult.rows[0]?.used||0};
  for(const key of ['game','daily','seat','provider'])if(counts[key]>=limits[key+'Limit']){await client.query('ROLLBACK');return {ok:false,reason:errors[key]};}
  await client.query('INSERT INTO avalon_ai_game_quota(game_id,used) VALUES ($1,1) ON CONFLICT(game_id) DO UPDATE SET used=avalon_ai_game_quota.used+1',[gameId]);
  await client.query('INSERT INTO avalon_ai_daily_quota(day,used) VALUES ($1,1) ON CONFLICT(day) DO UPDATE SET used=avalon_ai_daily_quota.used+1',[day]);
  await client.query('INSERT INTO avalon_ai_seat_quota(game_id,seat,used) VALUES ($1,$2,1) ON CONFLICT(game_id,seat) DO UPDATE SET used=avalon_ai_seat_quota.used+1',[gameId,seat]);
  await client.query('INSERT INTO avalon_ai_provider_daily_quota(day,provider,used) VALUES ($1,$2,1) ON CONFLICT(day,provider) DO UPDATE SET used=avalon_ai_provider_daily_quota.used+1',[day,provider]);
  await client.query('COMMIT');return {ok:true,game:counts.game+1};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
