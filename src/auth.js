import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const secret=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
const password=process.env.ADMIN_PASSWORD;
export function checkConfig(){if(process.env.NODE_ENV==='production'&&(!password||password.length<12||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32))throw Error('Set ADMIN_PASSWORD (12+ chars) and SESSION_SECRET (32+ chars)');}
const hmac=s=>createHmac('sha256',secret).update(s).digest('hex');
export function checkPassword(value){if(!password||typeof value!=='string')return false;const a=Buffer.from(hmac(value),'hex'),b=Buffer.from(hmac(password),'hex');return timingSafeEqual(a,b);}
export function sessionCookie(){const expiry=Date.now()+7*86400000;const nonce=randomBytes(12).toString('hex');const payload=`${expiry}.${nonce}`;return `avalon_session=${payload}.${hmac(payload)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;}
export function authorized(req){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('avalon_session='))?.slice(15);if(!cookie)return false;const parts=cookie.split('.');if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`;if(!/^\d+$/.test(parts[0])||Number(parts[0])<Date.now()||! /^[a-f0-9]{64}$/.test(parts[2]))return false;return timingSafeEqual(Buffer.from(hmac(payload),'hex'),Buffer.from(parts[2],'hex'));}
export function clearCookie(){return 'avalon_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';}
