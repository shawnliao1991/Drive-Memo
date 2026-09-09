import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';

// Cloud Run service identity accesses Firestore. Google user tokens stay encrypted.
export function createFirestoreStore(projectId,key,fetchImpl=fetch){
 if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId))throw Error('Invalid Firestore project ID');
 const base='https://firestore.googleapis.com/v1/projects/'+projectId+'/databases/(default)/documents/driveMemoSessions/';
 let credential;
 async function request(id,method='GET',body){
  if(!credential||credential.expires<Date.now()+60000){
   const response=await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Service identity unavailable');
   const token=await response.json();credential={token:token.access_token,expires:Date.now()+token.expires_in*1000};
  }
  return fetchImpl(base+createHash('sha256').update(id).digest('hex'),{method,headers:{Authorization:'Bearer '+credential.token,'Content-Type':'application/json'},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 }
 return {
  async get(id){const response=await request(id);if(response.status===404)return null;if(!response.ok)throw Error('Session storage unavailable');const doc=await response.json(),bytes=Buffer.from(doc.fields.payload.stringValue,'base64'),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));const value=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());return value.expires>Date.now()?value:null},
  async set(id,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]),payload=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');const response=await request(id,'PATCH',{fields:{payload:{stringValue:payload},expiresAt:{timestampValue:new Date(value.expires).toISOString()}}});if(!response.ok)throw Error('Session storage unavailable')},
  async delete(id){const response=await request(id,'DELETE');if(!response.ok&&response.status!==404)throw Error('Session storage unavailable')}
 };
}
