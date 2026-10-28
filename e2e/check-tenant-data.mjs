import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})})
try {
 const memberships=await db.salonMembership.groupBy({by:['userId'],where:{isActive:true},_count:{_all:true},having:{userId:{_count:{gt:1}}}})
 const customers=await db.user.count({where:{role:'CUSTOMER',salonMemberships:{none:{isActive:true}}}})
 console.log(JSON.stringify({duplicateMembershipUsers:memberships.length,unassignedCustomers:customers}))
}finally{await db.$disconnect()}
