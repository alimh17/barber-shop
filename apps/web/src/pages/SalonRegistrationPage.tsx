import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../auth/api';
import { useAuth } from '../auth/auth-context';
type Request = { id:string; name:string; slug:string; status:string; rejectionReason?:string };
export function SalonRegistrationPage() {
 const {session}=useAuth();
 const [name,setName]=useState('');const [slug,setSlug]=useState('');const [address,setAddress]=useState('');
 const [requests,setRequests]=useState<Request[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=()=>api.get<Request[]>('/salon-registrations/mine').then(r=>setRequests(r.data)).catch(()=>setError('Could not load requests'));
 useEffect(()=>{if(session)void load()},[session]);
 if(!session)return <main style={{padding:32}}><h1>Register your salon</h1><Link to="/login?purpose=salon-registration">Verify phone with OTP</Link></main>;
 return <main style={{padding:32,maxWidth:640,margin:'auto'}} dir="rtl"><h1>??????? ??? ????</h1>
 <p>?? ?? ????? ???? ??? ????? ?????? ???? ???? ??????.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api.post('/salon-registrations',{name,slug,address});setName('');setSlug('');setAddress('');await load()}catch(err){setError(getApiErrorMessage(err,'??? ??????? ?????? ???'))}finally{setBusy(false)}}}>
 <label>??? ????<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>????? ??????? ????<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value)}/></label>
 <label>????<input value={address} onChange={e=>setAddress(e.target.value)}/></label>
 <button disabled={busy} type="submit">??? ???????</button></form>
 {error&&<p role="alert">{error}</p>}
 <h2>??????????? ??</h2>{requests.map(r=><p key={r.id}>{r.name} ({r.slug}) ? {r.status} {r.rejectionReason||''}</p>)}
 </main>;
}
