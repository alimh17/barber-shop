import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Salon self registration (isolated PostgreSQL, real HTTP + OTP)',()=>{
 let app:INestApplication;let db:PrismaService;let applicantToken='';let adminToken='';let reqId='';let salonId='';
 const suffix=String(Math.floor(Math.random()*100000000)).padStart(8,'0');
 const phone='091'+suffix, adminPhone='092'+suffix;
 const uniqueSlug='registration-'+suffix;
 const api=()=>request(app.getHttpServer() as never);
 beforeAll(async()=>{
  if(!process.env.DATABASE_URL?.includes(':55439/registration_test'))throw Error('Refusing non-isolated database');
  const mod=await Test.createTestingModule({imports:[AppModule]}).compile();
  app=mod.createNestApplication();app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  await app.init();db=app.get(PrismaService);
  await db.user.create({data:{phone:adminPhone,role:'SUPER_ADMIN'}});
 },30000);
 afterAll(async()=>{if(app)await app.close()});
 it('keeps generic login restricted',async()=>{
  const r=await api().post('/api/auth/request-otp').send({phone});expect(r.status).toBe(400);
 });
 it('OTP registration + creates applicant',async()=>{
  const r=await api().post('/api/auth/request-otp').send({phone,purpose:'salon-registration'});
  expect(r.status).toBe(201);expect(r.body.otp).toMatch(/^\d{6}$/);
  const v=await api().post('/api/auth/verify-otp').send({phone,code:r.body.otp,purpose:'salon-registration'});
  expect(v.status).toBe(201);expect(v.body.user.role).toBe('CUSTOMER');applicantToken=v.body.accessToken;
  expect(await db.user.findUnique({where:{phone}})).toMatchObject({role:'CUSTOMER'});
 });
 it('denies customer reviewing requests',async()=>{
  const r=await api().get('/api/salon-registrations').set('Authorization','Bearer '+applicantToken);
  expect(r.status).toBe(403);
 });
 it('creates request and rejects duplicate',async()=>{
  const body={name:'Test Salon',slug:uniqueSlug,address:'Test address'};
  const r=await api().post('/api/salon-registrations').set('Authorization','Bearer '+applicantToken).send(body);
  expect(r.status).toBe(201);reqId=r.body.id;
  const duplicate=await api().post('/api/salon-registrations').set('Authorization','Bearer '+applicantToken).send({...body,slug:'other-slug'});
  expect(duplicate.status).toBe(409);
  const mine=await api().get('/api/salon-registrations/mine').set('Authorization','Bearer '+applicantToken);
  expect(mine.status).toBe(200);expect(mine.body).toHaveLength(1);
 });
 it('SUPER_ADMIN OTP + approval',async()=>{
  const r=await api().post('/api/auth/request-otp').send({phone:adminPhone});expect(r.status).toBe(201);
  const v=await api().post('/api/auth/verify-otp').send({phone:adminPhone,code:r.body.otp});
  expect(v.status).toBe(201);adminToken=v.body.accessToken;
  const list=await api().get('/api/salon-registrations').set('Authorization','Bearer '+adminToken);
  expect(list.status).toBe(200);expect(list.body.some((x:{id:string})=>x.id===reqId)).toBe(true);
  const approved=await api().post('/api/salon-registrations/'+reqId+'/approve').set('Authorization','Bearer '+adminToken);
  expect(approved.status).toBe(201);expect(approved.body.status).toBe('APPROVED');salonId=approved.body.salonId;
  expect(await db.user.findUnique({where:{phone}})).toMatchObject({role:'ADMIN'});
  expect(await db.salonMembership.findFirst({where:{salonId,user:{phone}}})).toBeTruthy();
 });
 it('prevents double approval and duplicate ownership',async()=>{
  const r=await api().post('/api/salon-registrations/'+reqId+'/approve').set('Authorization','Bearer '+adminToken);
  expect(r.status).toBe(409);
  const x=await api().post('/api/salon-registrations').set('Authorization','Bearer '+applicantToken).send({name:'Second',slug:'second-test'});
  expect(x.status).toBe(403);
  expect(await db.salon.count({where:{slug:uniqueSlug}})).toBe(1);
 });
 it('rejects invalid slugs and anonymous submissions',async()=>{
  const anon=await api().post('/api/salon-registrations').send({name:'No auth',slug:'no-auth'});
  expect(anon.status).toBe(401);
  const invalid=await api().post('/api/salon-registrations').set('Authorization','Bearer '+adminToken).send({name:'Bad',slug:'BAD SLUG'});
  expect(invalid.status).toBe(400);
 });
 it('rejects a separate pending request and prevents repeat decision',async()=>{
  const other='093'+String(Math.floor(Math.random()*100000000)).padStart(8,'0');
  const otp=await api().post('/api/auth/request-otp').send({phone:other,purpose:'salon-registration'});
  expect(otp.status).toBe(201);
  const v=await api().post('/api/auth/verify-otp').send({phone:other,code:otp.body.otp,purpose:'salon-registration'});
  expect(v.status).toBe(201);
  const token=v.body.accessToken;
  const created=await api().post('/api/salon-registrations').set('Authorization','Bearer '+token).send({name:'Rejected salon',slug:'rejected-'+String(Date.now())});
  expect(created.status).toBe(201);
  const rejected=await api().post('/api/salon-registrations/'+created.body.id+'/reject').set('Authorization','Bearer '+adminToken).send({reason:'Missing documents'});
  expect(rejected.status).toBe(201);expect(rejected.body.status).toBe('REJECTED');
  const twice=await api().post('/api/salon-registrations/'+created.body.id+'/reject').set('Authorization','Bearer '+adminToken).send({reason:'Repeated'});
  expect(twice.status).toBe(409);
  const mine=await api().get('/api/salon-registrations/mine').set('Authorization','Bearer '+token);
  expect(mine.status).toBe(200);expect(mine.body[0].rejectionReason).toBe('Missing documents');
 });
 it('uses updated role for authorization even with old token',async()=>{
  const r=await api().get('/api/salon-registrations').set('Authorization','Bearer '+applicantToken);
  expect(r.status).toBe(403);
 });
});
