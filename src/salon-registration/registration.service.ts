import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '../generated/prisma/client.js';
import { RegistrationDto } from './registration.dto.js';
@Injectable()
export class RegistrationService {
 constructor(private readonly prisma:PrismaService){}
 async submit(userId:string,dto:RegistrationDto) {
  return this.prisma.$transaction(async tx=>{
   const user=await tx.user.findUnique({where:{id:userId},include:{salonMemberships:{where:{isActive:true}}}});
   if(!user||user.role!=='CUSTOMER'||user.status!=='ACTIVE'||user.salonMemberships.length) throw new ForbiddenException('Not eligible');
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',userId);
   if(await tx.salonRegistrationRequest.findFirst({where:{applicantId:userId,status:'PENDING'}})) throw new ConflictException('Request pending');
   if(await tx.salon.findUnique({where:{slug:dto.slug}})) throw new ConflictException('Slug taken');
   if(await tx.salonRegistrationRequest.findFirst({where:{slug:dto.slug,status:'PENDING'}})) throw new ConflictException('Slug requested');
   return tx.salonRegistrationRequest.create({data:{applicantId:userId,name:dto.name,slug:dto.slug,address:dto.address,description:dto.description}});
  });
 }
 mine(userId:string){return this.prisma.salonRegistrationRequest.findMany({where:{applicantId:userId},orderBy:{createdAt:'desc'}})}
 list(){return this.prisma.salonRegistrationRequest.findMany({orderBy:{createdAt:'desc'},include:{applicant:{select:{id:true,phone:true,firstName:true,lastName:true}}}})}
 async approve(id:string,reviewerId:string){
  return this.prisma.$transaction(async tx=>{
   const existing=await tx.salonRegistrationRequest.findUnique({where:{id}});
   if(!existing) throw new NotFoundException('Request not found');
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',existing.applicantId);
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))',existing.slug);
   const req=await tx.salonRegistrationRequest.findUnique({where:{id}});
   if(!req||req.status!=='PENDING') throw new ConflictException('Already reviewed');
   const user=await tx.user.findUnique({where:{id:req.applicantId},include:{salonMemberships:{where:{isActive:true}}}});
   if(!user||user.role!=='CUSTOMER'||user.status!=='ACTIVE'||user.salonMemberships.length) throw new ConflictException('Applicant not eligible');
   if(await tx.salon.findUnique({where:{slug:req.slug}})) throw new ConflictException('Slug taken');
   const salon=await tx.salon.create({data:{name:req.name,slug:req.slug,phone:req.phone,address:req.address,description:req.description}});
   await tx.user.update({where:{id:user.id},data:{role:UserRole.ADMIN,refreshTokenHash:null}});
   await tx.salonMembership.create({data:{userId:user.id,salonId:salon.id}});
   return tx.salonRegistrationRequest.update({where:{id},data:{status:'APPROVED',salonId:salon.id,reviewedById:reviewerId,reviewedAt:new Date()}});
  });
 }
 async reject(id:string,reviewerId:string,reason:string){
  const updated=await this.prisma.salonRegistrationRequest.updateMany({where:{id,status:'PENDING'},data:{status:'REJECTED',rejectionReason:reason,reviewedById:reviewerId,reviewedAt:new Date()}});
  if(!updated.count) throw new ConflictException('Request not found or reviewed');
  return this.prisma.salonRegistrationRequest.findUnique({where:{id}});
 }
}
