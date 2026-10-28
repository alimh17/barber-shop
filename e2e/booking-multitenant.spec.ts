import { test, expect, type APIRequestContext } from '@playwright/test'
const base=process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api'
const A={salonId:'e409b649-2225-43f4-a20d-d7e94ec8518f',barberId:'0fb2982d-044d-493f-a7cb-daebfd70bbc8',serviceId:'0869aea3-2701-4403-9f3f-ed6b27fe86a7'}
const A2={...A,barberId:'0ca832c7-0e90-4583-8ccd-44379f373313'}
const B={salonId:'45a736f3-71f9-4d61-b0d4-95c78a121b66',barberId:'59d14e95-83fc-450c-b273-21a9e32754aa',serviceId:'00764a10-4ef1-4358-8d43-6df703edb93c'}
async function auth(r:APIRequestContext,phone:string){
 const otp=await r.post(base+'/auth/request-otp',{data:{phone}})
 expect(otp.ok()).toBeTruthy()
 const code=(await otp.json()).otp
 expect(code,'Only development OTP').toBeTruthy()
 const verified=await r.post(base+'/auth/verify-otp',{data:{phone,code}})
 expect(verified.ok()).toBeTruthy()
 return {Authorization:'Bearer '+(await verified.json()).accessToken}
}
async function slot(r:APIRequestContext,ids:typeof A,date:string,headers:Record<string,string>){
 const u=new URL(base+'/availability')
 Object.entries({...ids,date}).forEach(([k,v])=>u.searchParams.set(k,v))
 const result=await r.get(u.toString(),{headers})
 expect(result.ok()).toBeTruthy()
 const slots=(await result.json()).slots
 expect(slots.length).toBeGreaterThan(0)
 return slots[0].startAt as string
}
test('barber isolation within same salon and tenant isolation across salons',async ({request})=>{
 test.setTimeout(90000)
 const customer=await auth(request,'09120000981')
 const customerB=await auth(request,'09120000987')
 const barberA=await auth(request,'09120000982')
 const barberA2=await auth(request,'09120000985')
 const barberB=await auth(request,'09120000986')
 const adminA=await auth(request,'09120000983')
 const adminB=await auth(request,'09120000984')
 const date=new Date(Date.now()+9*86400000).toISOString().slice(0,10)
 const created=[]
 for(const ids of [A,A2,B]){
  const startAt=await slot(request,ids,date,ids.salonId===B.salonId?customerB:customer)
  const res=await request.post(base+'/appointments',{headers:ids.salonId===B.salonId?customerB:customer,data:{barberId:ids.barberId,serviceId:ids.serviceId,startAt}})
  expect(res.status()).toBe(201)
  created.push(await res.json())
 }
 const [one,two,three]=created
 for(const [headers,own,foreign] of [[barberA,one,two],[barberA2,two,one],[barberB,three,one]] as const){
  const list=await request.get(base+'/appointments',{headers})
  expect(list.status()).toBe(200)
  const ids=(await list.json()).map((x:{id:string})=>x.id)
  expect(ids).toContain(own.id)
  expect(ids).not.toContain(foreign.id)
  const blocked=await request.patch(base+'/appointments/'+foreign.id+'/status',{headers,data:{status:'CONFIRMED'}})
  expect(blocked.status()).toBe(404)
 }
 for(const [headers,own,foreign] of [[adminA,one,three],[adminB,three,one]] as const){
  const list=await request.get(base+'/appointments',{headers})
  expect(list.status()).toBe(200)
  const ids=(await list.json()).map((x:{id:string})=>x.id)
  expect(ids).toContain(own.id)
  expect(ids).not.toContain(foreign.id)
  const detail=await request.get(base+'/appointments/'+foreign.id,{headers})
  expect([403,404]).toContain(detail.status())
  const change=await request.patch(base+'/appointments/'+foreign.id+'/status',{headers,data:{status:'CONFIRMED'}})
  expect([403,404]).toContain(change.status())
  const cancel=await request.delete(base+'/appointments/'+foreign.id,{headers})
  expect([403,404]).toContain(cancel.status())
 }
 const invalidCrossSalon=await request.post(base+'/appointments',{headers:customer,data:{barberId:B.barberId,serviceId:A.serviceId,startAt:three.startAt}})
 expect(invalidCrossSalon.status()).toBe(403)
})
