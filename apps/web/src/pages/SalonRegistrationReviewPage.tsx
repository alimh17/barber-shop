import { useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../auth/api';
type Request = { id:string; name:string; slug:string; status:string; applicant:{phone:string} };
export function SalonRegistrationReviewPage(){
 const [items,setItems]=useState<Request[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=()=>api.get<Request[]>('/salon-registrations').then(r=>setItems(r.data)).catch(()=>setError('Loading failed'));
 useEffect(()=>{void load()},[]);
 async function decide(id:string,action:'approve'|'reject'){const reason=action==='reject'?window.prompt('???? ?? ???????'):undefined;if(action==='reject'&&!reason)return;setBusy(true);setError('');try{await api.post('/salon-registrations/'+id+'/'+action,action==='reject'?{reason}:{});await load()}catch(e){setError(getApiErrorMessage(e,'?????? ?????? ???'))}finally{setBusy(false)}}
 return <main style={{padding:24}} dir="rtl"><h1>??????????? ??? ????</h1>{error&&<p role="alert">{error}</p>}
 {items.map(r=><section key={r.id} style={{padding:16,borderBottom:'1px solid gray'}}><strong>{r.name}</strong><p>{r.slug} ? {r.applicant.phone} ? {r.status}</p>{r.status==='PENDING'&&<><button disabled={busy} onClick={()=>void decide(r.id,'approve')}>?????</button><button disabled={busy} onClick={()=>void decide(r.id,'reject')}>??</button></>}</section>)}</main>;
}
