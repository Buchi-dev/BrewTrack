import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
const ids = { admin:'10000000-0000-0000-0000-000000000001', manager:'10000000-0000-0000-0000-000000000002', employee:'10000000-0000-0000-0000-000000000003', other:'10000000-0000-0000-0000-000000000004', b1:'20000000-0000-0000-0000-000000000001', b2:'20000000-0000-0000-0000-000000000002' }
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text, unique(bucket_id,name));
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
alter table storage.objects enable row level security;
grant usage on schema auth,storage to authenticated,anon;
grant execute on function auth.uid(),storage.foldername(text) to authenticated,anon;
grant select,insert,update,delete on storage.objects to authenticated;
`)
await db.exec(await readFile(new URL('../../supabase/migrations/20260924095205_workforce_attendance.sql', import.meta.url),'utf8'))
console.log('PASS: complete migration applies to PostgreSQL')
await db.exec(`
insert into auth.users values ('${ids.admin}'),('${ids.manager}'),('${ids.employee}'),('${ids.other}');
insert into public.profiles(id,name,role) values ('${ids.admin}','Admin','admin'),('${ids.manager}','Manager','manager'),('${ids.employee}','Employee','employee'),('${ids.other}','Other','employee');
insert into public.branches(id,name) values ('${ids.b1}','Branch One'),('${ids.b2}','Branch Two');
insert into public.manager_branches values ('${ids.manager}','${ids.b1}');
insert into public.employees(id,code,name,email,branch_id) values ('${ids.employee}','E001','Employee','e@example.com','${ids.b1}'),('${ids.other}','E002','Other','o@example.com','${ids.b2}');
`)
async function asUser(id, sql, params=[]) {
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
  try { return (await db.query(sql,params)).rows } finally { await db.exec('reset role'); await db.exec("select set_config('request.jwt.claim.sub','',false)") }
}
async function deny(label, fn) { await assert.rejects(fn); console.log(`PASS: ${label}`) }
assert.equal((await asUser(ids.employee,'select * from public.employees')).length,1)
assert.equal((await asUser(ids.manager,'select * from public.employees')).length,1)
assert.equal((await asUser(ids.admin,'select * from public.employees')).length,2)
console.log('PASS: employee ownership and manager branch isolation')
await deny('employee cannot promote their role',()=>asUser(ids.employee,"update public.profiles set role='admin' where id=$1",[ids.employee]))
assert.equal((await asUser(ids.employee,'update public.employees set branch_id=$1 where id=$2 returning *',[ids.b2,ids.employee])).length,0)
await deny('manager cannot move staff outside assigned branches',()=>asUser(ids.manager,'update public.employees set branch_id=$1 where id=$2',[ids.b2,ids.employee]))
await deny('clock-out requires a clock-in',()=>asUser(ids.employee,"select public.begin_attendance('clock-out')"))
const [first] = await asUser(ids.employee,"select public.begin_attendance('clock-in') as challenge")
const c = first.challenge
const path = `${ids.employee}/${c.id}.jpg`
await deny('attendance requires an uploaded selfie',()=>asUser(ids.employee,'insert into public.attendance_records(employee_id,challenge_id,photo_path) values($1,$2,$3)',[ids.employee,c.id,path]))
await deny('another employee cannot upload to the camera session',()=>asUser(ids.other,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['attendance-selfies',path,ids.other]))
await asUser(ids.employee,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['attendance-selfies',path,ids.employee])
const [record] = await asUser(ids.employee,'insert into public.attendance_records(employee_id,challenge_id,photo_path) values($1,$2,$3) returning *',[ids.employee,c.id,path])
assert.equal(new Date(record.official_timestamp).getTime(),new Date(c.issued_at).getTime())
assert.equal(record.employee_name,'Employee')
assert.equal(record.branch_id,ids.b1)
console.log('PASS: attendance snapshots identity and uses the server session timestamp')
await deny('duplicate clock-in prevented',()=>asUser(ids.employee,"select public.begin_attendance('clock-in')"))
await deny('challenge replay prevented',()=>asUser(ids.employee,'insert into public.attendance_records(employee_id,challenge_id,photo_path) values($1,$2,$3)',[ids.employee,c.id,path]))
await deny('attendance history immutable for managers',()=>asUser(ids.manager,"update public.attendance_records set status='on-time' where id=$1",[record.id]))
await deny('employee cannot forge official timestamp',()=>asUser(ids.employee,'insert into public.attendance_records(employee_id,challenge_id,photo_path,official_timestamp) values($1,$2,$3,now())',[ids.employee,c.id,path]))
assert.equal((await asUser(ids.other,'select * from public.attendance_records')).length,0)
assert.equal((await asUser(ids.other,'select * from storage.objects')).length,0)
assert.equal((await asUser(ids.manager,'select * from storage.objects')).length,1)
assert.equal((await asUser(ids.employee,"update storage.objects set name='changed' returning *")).length,0)
assert.equal((await asUser(ids.employee,'delete from storage.objects returning *')).length,0)
console.log('PASS: private evidence visibility and immutable storage policies')
await asUser(ids.manager,'insert into public.attendance_reviews(attendance_id,verdict,note) values($1,$2,$3)',[record.id,'verified','Matches employee'])
await deny('employees cannot approve evidence',()=>asUser(ids.employee,'insert into public.attendance_reviews(attendance_id,verdict) values($1,$2)',[record.id,'verified']))
assert.equal((await asUser(ids.admin,'select * from public.audit_logs')).length,2)
console.log('PASS: reviews and attendance produce audit history')
const [{challenge:out}] = await asUser(ids.employee,"select public.begin_attendance('clock-out') as challenge")
const outPath = `${ids.employee}/${out.id}.jpg`
await asUser(ids.employee,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['attendance-selfies',outPath,ids.employee])
const [completed] = await asUser(ids.employee,'insert into public.attendance_records(employee_id,challenge_id,photo_path) values($1,$2,$3) returning *',[ids.employee,out.id,outPath])
assert.equal(completed.status,'completed')
console.log('PASS: complete clock-in and clock-out workflow')
const [{challenge:expired}] = await asUser(ids.other,"select public.begin_attendance('clock-in') as challenge")
await db.query("update public.capture_challenges set expires_at=now()-interval '1 second' where id=$1",[expired.id])
await deny('expired camera session cannot upload',()=>asUser(ids.other,'insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['attendance-selfies',`${ids.other}/${expired.id}.jpg`,ids.other]))
await db.exec('set role anon')
await deny('anonymous users cannot start attendance',()=>db.query("select public.begin_attendance('clock-in')"))
await db.exec('reset role')
await db.close()
console.log('All database security tests passed. Storage/Auth service behavior requires a Supabase integration test.')

