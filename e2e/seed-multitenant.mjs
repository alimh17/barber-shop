import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'
if (process.env.E2E_ALLOW_SEED !== 'yes') throw Error('Set E2E_ALLOW_SEED=yes')
if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL ?? '').hostname)) throw Error('Only local test DB')
const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})})
try {
 const output = await db.$transaction(async tx => {
  const salonA = await tx.salon.findUniqueOrThrow({where:{slug:'e2e-playwright-salon'}})
  const salonB = await tx.salon.upsert({where:{slug:'e2e-playwright-salon-b'},update:{isActive:true},create:{name:'E2E Second Salon',slug:'e2e-playwright-salon-b',timezone:'Asia/Tehran'}})
  const user = async (phone,role,firstName,lastName) => tx.user.upsert({where:{phone},update:{role,status:'ACTIVE',firstName,lastName},create:{phone,role,firstName,lastName}})
  const customerB = await user('09120000987','CUSTOMER','E2E','CustomerB')
  await tx.customer.upsert({where:{userId:customerB.id},update:{},create:{userId:customerB.id}})
  await tx.salonMembership.upsert({where:{userId_salonId:{userId:customerB.id,salonId:salonB.id}},update:{isActive:true},create:{userId:customerB.id,salonId:salonB.id}})
  const adminA = await user('09120000983','ADMIN','E2E','AdminA')
  const adminB = await user('09120000984','ADMIN','E2E','AdminB')
  await tx.salonMembership.upsert({where:{userId_salonId:{userId:adminA.id,salonId:salonA.id}},update:{isActive:true},create:{userId:adminA.id,salonId:salonA.id}})
  await tx.salonMembership.upsert({where:{userId_salonId:{userId:adminB.id,salonId:salonB.id}},update:{isActive:true},create:{userId:adminB.id,salonId:salonB.id}})
  const barberA2User = await user('09120000985','BARBER','E2E','BarberTwo')
  const barberBUser = await user('09120000986','BARBER','E2E','BarberB')
  const barberA2 = await tx.barber.upsert({where:{userId:barberA2User.id},update:{salonId:salonA.id,isActive:true},create:{userId:barberA2User.id,salonId:salonA.id}})
  const barberB = await tx.barber.upsert({where:{userId:barberBUser.id},update:{salonId:salonB.id,isActive:true},create:{userId:barberBUser.id,salonId:salonB.id}})
  let serviceB=await tx.service.findFirst({where:{salonId:salonB.id,name:'E2E Haircut B'}})
  if(!serviceB) serviceB=await tx.service.create({data:{salonId:salonB.id,name:'E2E Haircut B',duration:30,price:160000}})
  const serviceA=await tx.service.findFirstOrThrow({where:{salonId:salonA.id,name:'E2E Haircut'}})
  for(const [barber,service,salon] of [[barberA2,serviceA,salonA],[barberB,serviceB,salonB]]){
   await tx.barberService.upsert({where:{barberId_serviceId:{barberId:barber.id,serviceId:service.id}},update:{},create:{barberId:barber.id,serviceId:service.id}})
   for(const dayOfWeek of ['SATURDAY','SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY']){
    await tx.workingHour.upsert({where:{barberId_dayOfWeek:{barberId:barber.id,dayOfWeek}},update:{startTime:'09:00',endTime:'22:00',isActive:true},create:{salonId:salon.id,barberId:barber.id,dayOfWeek,startTime:'09:00',endTime:'22:00'}})
   }
  }
  return {salonA:salonA.id,salonB:salonB.id,barberA2:barberA2.id,barberB:barberB.id,serviceB:serviceB.id}
 })
 console.log(JSON.stringify(output))
}finally{await db.$disconnect()}
