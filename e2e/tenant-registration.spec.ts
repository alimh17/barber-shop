import { test, expect, type APIRequestContext } from '@playwright/test'

const base = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001/api'
const salonA = 'e2e-playwright-salon'
const salonB = 'e2e-playwright-salon-b'
const aId = 'e409b649-2225-43f4-a20d-d7e94ec8518f'
const bId = '45a736f3-71f9-4d61-b0d4-95c78a121b66'
async function login(request:APIRequestContext, phone:string, salonSlug?:string) {
 const otp=await request.post(base+'/auth/request-otp',{data:{phone}})
 expect(otp.ok()).toBeTruthy()
 const code=(await otp.json()).otp
 expect(code).toBeTruthy()
 return request.post(base+'/auth/verify-otp',{data:{phone,code,salonSlug}})
}
test('salon invitation registration, cross-salon isolation and direct access denial',async ({request})=>{
 test.setTimeout(60000)
 expect((await request.get(base+'/salons')).status()).toBe(401)
 const publicSalon=await request.get(base+'/salons/by-slug/'+salonA)
 expect(publicSalon.status()).toBe(200)
 expect((await publicSalon.json()).slug).toBe(salonA)
 const phone='09120000990'
 const first=await login(request,phone,salonA)
 expect(first.status()).toBe(201)
 const headers={Authorization:'Bearer '+(await first.json()).accessToken}
 const salons=await request.get(base+'/salons',{headers})
 expect(salons.status()).toBe(200)
 expect((await salons.json()).map((x:{id:string})=>x.id)).toEqual([aId])
 expect((await request.get(base+'/salons/'+bId,{headers})).status()).toBe(404)
 expect((await request.get(base+'/barbers?salonId='+bId,{headers})).status()).toBe(403)
 expect((await request.get(base+'/barbers/59d14e95-83fc-450c-b273-21a9e32754aa/services',{headers})).status()).toBe(403)
 expect((await request.get(base+'/availability?salonId='+bId+'&barberId=59d14e95-83fc-450c-b273-21a9e32754aa&serviceId=00764a10-4ef1-4358-8d43-6df703edb93c&date=2026-11-15',{headers})).status()).toBe(403)
 const wrong=await login(request,phone,salonB)
 expect(wrong.status()).toBe(403)
 const again=await login(request,phone,salonA)
 expect(again.status()).toBe(201)
 const unassigned=await login(request,'09120000991')
 expect(unassigned.status()).toBe(400)
})

test('each salon admin sees only own customers', async ({request})=>{
 const adminA=await login(request,'09120000983')
 const adminB=await login(request,'09120000984')
 expect(adminA.status()).toBe(201)
 expect(adminB.status()).toBe(201)
 const headersA={Authorization:'Bearer '+(await adminA.json()).accessToken}
 const headersB={Authorization:'Bearer '+(await adminB.json()).accessToken}
 const listA=await request.get(base+'/users?role=CUSTOMER&limit=100',{headers:headersA})
 const listB=await request.get(base+'/users?role=CUSTOMER&limit=100',{headers:headersB})
 expect(listA.status()).toBe(200)
 expect(listB.status()).toBe(200)
 const phonesA=(await listA.json()).items.map((u:{phone:string})=>u.phone)
 const phonesB=(await listB.json()).items.map((u:{phone:string})=>u.phone)
 expect(phonesA).toContain('09120000981')
 expect(phonesA).not.toContain('09120000987')
 expect(phonesB).toContain('09120000987')
 expect(phonesB).not.toContain('09120000981')
})
