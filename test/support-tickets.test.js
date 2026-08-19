import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSehatLineServer } from "../backend/src/server.js";

test("public Help Center tickets reach the protected Admin support inbox", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(),"sehatline-support-"));
  const { server, adminAuth, store } = await createSehatLineServer({ dataFile:path.join(directory,"runtime.json"), adminJwtSecret:"test-support-secret-with-more-than-thirty-two-characters", logger:{error(){},warn(){}} });
  await adminAuth.createFirstSuperAdmin({ fullName:"Support Owner", email:"support-owner@sehatline.test", mobile:"+91 90000 12345", password:"Support!Pass9" });
  await store.mutate(data => { data.admins[0].mustChangePassword = false; });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const createdResponse=await fetch(`${base}/api/support/tickets`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Aarav Kumar",email:"aarav@example.test",role:"patient",category:"booking",subject:"Booking confirmation missing",message:"My confirmed booking is not visible in appointments."})});
    assert.equal(createdResponse.status,201); const created=await createdResponse.json(); assert.match(created.reference,/^SL-SUP-/);
    assert.equal((await fetch(`${base}/api/admin/support-tickets`)).status,401);
    const login=await fetch(`${base}/api/admin/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"support-owner@sehatline.test",password:"Support!Pass9"})});
    const auth=await login.json(),cookie=String(login.headers.get("set-cookie")).split(";")[0];
    const request=(url,options={})=>fetch(`${base}${url}`,{...options,headers:{"Content-Type":"application/json","Cookie":cookie,"X-Admin-CSRF":auth.csrfToken,...options.headers}});
    const inbox=await request("/api/admin/support-tickets").then(response=>response.json()); assert.equal(inbox.total,1); assert.equal(inbox.items[0].reference,created.reference);
    const updatedResponse=await request(`/api/admin/support-tickets/${inbox.items[0].id}`,{method:"PATCH",body:JSON.stringify({status:"resolved",priority:"high",adminNote:"Requester contacted by email."})});
    assert.equal(updatedResponse.status,200); const updated=await updatedResponse.json(); assert.equal(updated.status,"resolved"); assert.equal(updated.priority,"high");
  } finally { await new Promise(resolve=>server.close(resolve)); await rm(directory,{recursive:true,force:true}); }
});
