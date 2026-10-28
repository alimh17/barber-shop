import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})})
try {
 const ids=['98713ed2-207f-47e6-a232-90f8fae843c9','01d6c228-6c38-48db-a2e0-c6abd29d546d']
 const a=await db.appointment.findMany({where:{id:{in:ids}},select:{id:true,status:true,createdAt:true,salon:{select:{slug:true}},customer:{select:{user:{select:{phone:true}},userId:true}},barber:{select:{salon:{select:{slug:true}}}}}})
 console.log(JSON.stringify(a,null,2))
}finally{await db.$disconnect()}
