import { describe, expect, it, vi } from 'vitest';
import { RegistrationService } from './registration.service.js';

describe('Salon registration approval', () => {
 it('rejects an applicant already assigned to a salon', async () => {
  const tx = { user: { findUnique: vi.fn().mockResolvedValue({ role:'CUSTOMER',status:'ACTIVE',salonMemberships:[{id:'existing'}] }) } };
  const prisma = { $transaction: (fn: (tx:typeof tx)=>unknown) => fn(tx) };
  const service = new RegistrationService(prisma as never);
  await expect(service.submit('user-1',{name:'Salon',slug:'salon'})).rejects.toThrow('Not eligible');
 });
 it('prevents a second pending request', async () => {
  const tx = {
   user: {findUnique:vi.fn().mockResolvedValue({role:'CUSTOMER',status:'ACTIVE',salonMemberships:[]})},
   $executeRawUnsafe:vi.fn(),
   salonRegistrationRequest:{findFirst:vi.fn().mockResolvedValue({id:'pending'})}
  };
  const service = new RegistrationService({$transaction:(fn:(tx:typeof tx)=>unknown)=>fn(tx)} as never);
  await expect(service.submit('user-1',{name:'Salon',slug:'salon'})).rejects.toThrow('Request pending');
 });
 it('rejects double approval before creating another salon', async () => {
  const tx = {
   salonRegistrationRequest:{findUnique:vi.fn().mockResolvedValueOnce({id:'req',applicantId:'user',slug:'salon'}).mockResolvedValueOnce({id:'req',status:'APPROVED'})},
   $executeRawUnsafe:vi.fn(),
   salon:{create:vi.fn()}
  };
  const service = new RegistrationService({$transaction:(fn:(tx:typeof tx)=>unknown)=>fn(tx)} as never);
  await expect(service.approve('req','reviewer')).rejects.toThrow('Already reviewed');
  expect(tx.salon.create).not.toHaveBeenCalled();
 });
 it('approves atomically and creates a scoped admin membership', async () => {
  const tx = {
   salonRegistrationRequest: {
    findUnique:vi.fn().mockResolvedValueOnce({id:'req',applicantId:'user',slug:'my-salon'}).mockResolvedValueOnce({id:'req',applicantId:'user',slug:'my-salon',name:'My salon',status:'PENDING'}),
    update:vi.fn().mockResolvedValue({id:'req',status:'APPROVED'})
   },
   $executeRawUnsafe:vi.fn(),
   user:{findUnique:vi.fn().mockResolvedValue({id:'user',role:'CUSTOMER',status:'ACTIVE',salonMemberships:[]}),update:vi.fn()},
   salon:{findUnique:vi.fn().mockResolvedValue(null),create:vi.fn().mockResolvedValue({id:'salon-id'})},
   salonMembership:{create:vi.fn()}
  };
  const service = new RegistrationService({$transaction:(fn:(tx:typeof tx)=>unknown)=>fn(tx)} as never);
  await service.approve('req','super-admin');
  expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({role:'ADMIN',refreshTokenHash:null})}));
  expect(tx.salonMembership.create).toHaveBeenCalledWith({data:{userId:'user',salonId:'salon-id'}});
 });
 it('does not reject a request twice', async () => {
  const service = new RegistrationService({salonRegistrationRequest:{updateMany:vi.fn().mockResolvedValue({count:0})}} as never);
  await expect(service.reject('req','reviewer','Reason')).rejects.toThrow('Request not found or reviewed');
 });
});
