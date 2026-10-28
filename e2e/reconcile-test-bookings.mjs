import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'
const url = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('Local database only')
if (process.env.E2E_ALLOW_RECONCILE !== 'yes') throw Error('Set E2E_ALLOW_RECONCILE=yes')
const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})})
try {
 const ids=['98713ed2-207f-47e6-a232-90f8fae843c9','01d6c228-6c38-48db-a2e0-c6abd29d546d']
 const rows=await db.appointment.findMany({where:{id:{in:ids}},select:{id:true,status:true,salon:{select:{slug:true}},customer:{select:{user:{select:{phone:true}}}}}})
 if(rows.length!==2 || rows.some(x=>x.status!=='PENDING'||x.salon.slug!=='e2e-playwright-salon-b'||x.customer.user.phone!=='09120000981')) throw Error('Fixture mismatch; refusing update')
 const result=await db.appointment.updateMany({where:{id:{in:ids},status:'PENDING'},data:{status:'CANCELLED'}})
 if(result.count!==2) throw Error('Unexpected affected count')
 console.log(JSON.stringify({cancelledTestAppointments:result.count}))
}finally{await db.$disconnect()}
