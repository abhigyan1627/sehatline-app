import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSehatLineServer } from "../backend/src/server.js";

test("public-care and health-support APIs expose only active verified data with filters", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-ecosystem-"));
  const { server, store } = await createSehatLineServer({
    dataFile: path.join(directory, "runtime.json"),
    adminJwtSecret: "test-only-ecosystem-secret-with-more-than-thirty-two-characters",
    logger: { error() {}, warn() {} }
  });
  await store.mutate(data => {
    data.publicFacilities.push({ id: "pf-1", name: "Verified Sadar Facility", facilityType: "SADAR_HOSPITAL", state: "Bihar", district: "Gopalganj", active: true, verified: true });
    data.publicFacilities.push({ id: "pf-hidden", name: "Inactive Facility", state: "Bihar", district: "Gopalganj", active: false });
    data.healthSupportLocations.push({ id: "hs-1", name: "Verified Jan Aushadhi", type: "JAN_AUSHADHI", state: "Bihar", district: "Patna", active: true });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const facilities = await fetch(`${base}/api/public-care/facilities?state=Bihar&district=Gopalganj`).then(response => response.json());
    assert.equal(facilities.pagination.total, 1);
    assert.equal(facilities.items[0].id, "pf-1");
    const detail = await fetch(`${base}/api/public-care/facilities/pf-1`).then(response => response.json());
    assert.equal(detail.facilityType, "SADAR_HOSPITAL");
    const locations = await fetch(`${base}/api/health-support/locations?type=JAN_AUSHADHI`).then(response => response.json());
    assert.equal(locations.items[0].id, "hs-1");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("Google location proxy restricts autocomplete to India and normalizes small-place details", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-google-location-"));
  const requests = [];
  const providerFetch = async (url, options = {}) => {
    requests.push({ url:String(url), body:options.body ? JSON.parse(options.body) : null });
    if (String(url).includes("places:autocomplete")) return new Response(JSON.stringify({ suggestions:[{ placePrediction:{ placeId:"thawe-1", text:{text:"Thawe, Bihar, India"}, structuredFormat:{mainText:{text:"Thawe"},secondaryText:{text:"Gopalganj, Bihar, India"}} } }] }), { status:200 });
    return new Response(JSON.stringify({ id:"thawe-1", displayName:{text:"Thawe"}, formattedAddress:"Thawe, Gopalganj, Bihar, India", location:{latitude:26.43,longitude:84.39}, addressComponents:[{longText:"India",shortText:"IN",types:["country"]},{longText:"Bihar",shortText:"BR",types:["administrative_area_level_1"]},{longText:"Gopalganj",shortText:"Gopalganj",types:["administrative_area_level_2"]},{longText:"Thawe",shortText:"Thawe",types:["administrative_area_level_3"]}] }), { status:200 });
  };
  const { server } = await createSehatLineServer({ dataFile:path.join(directory,"runtime.json"), adminJwtSecret:"test-google-location-secret-more-than-thirty-two-characters", googleMapsServerApiKey:"test-key-never-logged", providerFetch, logger:{error(){},warn(){}} });
  await new Promise((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const predictions = await fetch(`${base}/api/location/autocomplete?input=Thawe&sessionToken=session-1`).then(response => response.json());
    assert.equal(predictions.suggestions[0].primaryText,"Thawe");
    assert.deepEqual(requests[0].body.includedRegionCodes,["in"]);
    assert.equal(requests[0].body.sessionToken,"session-1");
    const place = await fetch(`${base}/api/location/place?placeId=thawe-1`).then(response => response.json());
    assert.equal(place.provider,"google"); assert.equal(place.district,"Gopalganj"); assert.equal(place.village,"Thawe"); assert.equal(place.city,"");
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory,{recursive:true,force:true}); }
});

test("admin can create, verify and disable every Healthcare Network record", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-network-admin-"));
  const { server, adminAuth, store } = await createSehatLineServer({ dataFile:path.join(directory,"runtime.json"), adminJwtSecret:"test-only-network-admin-secret-with-more-than-thirty-two-characters", logger:{ error(){}, warn(){} } });
  await adminAuth.createFirstSuperAdmin({ fullName:"Network Owner", email:"network@sehatline.test", mobile:"+91 98765 40000", password:"Network!Pass9" });
  await store.mutate(data => { data.admins[0].mustChangePassword = false; });
  await new Promise((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/admin/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({identifier:"network@sehatline.test",password:"Network!Pass9"}) });
    const auth = await login.json(), cookie = String(login.headers.get("set-cookie")).split(";")[0];
    const request = (url, options = {}) => fetch(`${base}${url}`, { ...options, headers:{"Content-Type":"application/json","Cookie":cookie,"X-Admin-CSRF":auth.csrfToken,...options.headers} });
    const records = [
      ["/api/admin/public-facilities",{name:"Authoritative Sadar Hospital",facilityType:"SADAR_HOSPITAL",state:"Bihar",district:"Gopalganj",active:true,verified:true}],
      ["/api/admin/health-support/locations",{name:"Authoritative Jan Aushadhi",type:"JAN_AUSHADHI",state:"Bihar",district:"Gopalganj",active:true,verified:true}],
      ["/api/admin/government-schemes",{name:"Authoritative Scheme",governmentLevel:"STATE",state:"Bihar",category:"Health",officialUrl:"https://example.gov.in/scheme",active:true,verified:true}],
      ["/api/admin/insurance",{provider:"Government Provider",planName:"Authoritative Plan",insuranceType:"GOVERNMENT",officialUrl:"https://example.gov.in/plan",active:true,verified:true}]
    ];
    for (const [endpoint,payload] of records) {
      const createdResponse = await request(endpoint,{method:"POST",body:JSON.stringify(payload)});
      assert.equal(createdResponse.status,201);
      const created = await createdResponse.json();
      assert.equal(created.verified,true);
      const disabledResponse = await request(`${endpoint}/${created.id}/status`,{method:"PATCH",body:JSON.stringify({active:false})});
      assert.equal(disabledResponse.status,200);
      assert.equal((await disabledResponse.json()).active,false);
    }
    const publicList = await fetch(`${base}/api/public-care/facilities`).then(response => response.json());
    assert.equal(publicList.pagination.total,0,"disabled admin record must disappear from patient listings");
    const adminList = await request("/api/admin/public-facilities?status=inactive").then(response => response.json());
    assert.equal(adminList.pagination.total,1,"soft-disabled record remains manageable by admin");
    const rejected = await request("/api/admin/public-facilities",{method:"POST",body:JSON.stringify({name:"Invalid facility",facilityType:"INVALID"})});
    assert.equal(rejected.status,422);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory,{recursive:true,force:true});
  }
});

test("existing Admin Panel contains native Healthcare Network tables and full forms", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../admin_panel/index.html", import.meta.url), "utf8"),
    readFile(new URL("../admin_panel/app.js", import.meta.url), "utf8")
  ]);
  for (const label of ["Public Facilities","Jan Aushadhi","Government Schemes","Insurance"]) assert.match(html,new RegExp(label));
  for (const field of ["facilityType","opdTimings","emergencyAvailable","openingHours","governmentLevel","applicationProcess","insuranceType","officialUrl"]) assert.match(script,new RegExp(field));
  assert.doesNotMatch(script,/prompt\(`\$\{label\}/,"Healthcare Network must use the existing modal form, not browser prompts");
});

test("authenticated patient saved items are unique, removable and hide inactive records", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(),"sehatline-saved-care-"));
  const { server, store } = await createSehatLineServer({ dataFile:path.join(directory,"runtime.json"), identitySandboxEnabled:true, adminJwtSecret:"test-only-saved-items-secret-with-more-than-thirty-two-characters", logger:{error(){},warn(){}} });
  await store.mutate(data => data.publicFacilities.push({id:"facility-save-1",name:"Save Test Facility",facilityType:"PHC",active:true,verified:true}));
  await new Promise((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/patient/saved-items`)).status,401);
    const started = await fetch(`${base}/api/auth/patient/identity/start`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:"+91 90000 10001",consent:true,profile:{name:"Saved Care Patient",dateOfBirth:"1995-01-01"}})}).then(response => response.json());
    const completed = await fetch(`${base}/api/auth/patient/identity/complete`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({verificationId:started.verificationId})}).then(response => response.json());
    const request = (url,options={}) => fetch(`${base}${url}`,{...options,headers:{"Content-Type":"application/json","Authorization":`Bearer ${completed.token}`,...options.headers}});
    for (let attempt=0; attempt<2; attempt++) assert.equal((await request("/api/patient/saved-items",{method:"POST",body:JSON.stringify({itemType:"PUBLIC_FACILITY",itemId:"facility-save-1"})})).status,200);
    let saved = await request("/api/patient/saved-items").then(response => response.json());
    assert.equal(saved.total,1,"duplicate save must not create a second relation");
    await store.mutate(data => { data.publicFacilities[0].active = false; });
    saved = await request("/api/patient/saved-items").then(response => response.json());
    assert.equal(saved.total,0,"inactive saved item must not expose a broken patient link");
    assert.equal((await request("/api/patient/saved-items/PUBLIC_FACILITY:facility-save-1",{method:"DELETE"})).status,200);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory,{recursive:true,force:true}); }
});

test("patient ecosystem uses dedicated routes, backend filtering and one-profile saved UI", async () => {
  const script = await readFile(new URL("../patient_app/app.js",import.meta.url),"utf8");
  for (const route of ["health-support/jan-aushadhi","health-support/government-schemes","health-support/insurance","health-support/medicines","public-care-detail","jan-aushadhi-detail","scheme-detail","insurance-detail"]) assert.match(script,new RegExp(route.replaceAll("/","\\/")));
  for (const feature of ["loadPatientEcosystemRoute","toggleHealthcareSave","renderMyHealthcare","care-pagination","data-care-filter","Eligibility information is indicative"]) assert.match(script,new RegExp(feature));
  assert.doesNotMatch(script,/const hospitals\s*=\s*\[/i,"patient Public Care must not contain a hardcoded production hospital list");
});
