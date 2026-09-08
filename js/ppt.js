import {auth,db,storage} from "./firebase.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {addDoc,collection,serverTimestamp,onSnapshot} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {ref,uploadBytes,getDownloadURL} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
let user;onAuthStateChanged(auth,u=>{user=u;if(!u)location.href="login.html"});
const $=id=>document.getElementById(id);
async function readFile(f){if(f.type.startsWith("text/")||f.name.endsWith(".md"))return await f.text();return `[Uploaded file: ${f.name}. Server-side extractor/OCR should process this file.]`;}
$("createPptBtn").onclick=async()=>{
 if(!user)return;const fs=[...$("notesFiles").files];if(!fs.length){$("pptStatus").textContent="कम से कम एक notes/PDF/image file चुनें.";return}
 const btn=$("createPptBtn");btn.disabled=true;$("pptStatus").textContent="Notes पढ़े जा रहे हैं…";
 try{let texts=[];for(const f of fs)texts.push(await readFile(f));let uploads=[];for(const f of fs){const r=ref(storage,`uploads/${user.uid}/ppt/${Date.now()}-${f.name}`);await uploadBytes(r,f);uploads.push(await getDownloadURL(r))}
 const docRef=await addDoc(collection(db,"presentations"),{userId:user.uid,title:$("pptTitle").value.trim()||"AI Presentation",sourceFiles:uploads,sourceText:texts.join("\n\n").slice(0,50000),instruction:$("extra").value.trim(),status:"queued",createdAt:serverTimestamp()});
 $("pptStatus").textContent="AI presentation queued…";const unsub=onSnapshot(docRef,s=>{const d=s.data();if(!d)return;if(d.status==="ready"){unsub();$("pptStatus").textContent="✅ PPT तैयार है!";$("pptResult").classList.remove("hidden");$("pptResult").innerHTML=`<h2>📊 ${d.title||"AI PPT"}</h2><p>${d.slideCount||""} slides</p><a class="primary" target="_blank" href="${d.outputUrl}">Download PPTX</a>`}else if(d.status==="error"){unsub();$("pptStatus").textContent="❌ "+(d.error||"PPT failed")}})}catch(e){$("pptStatus").textContent="❌ "+e.message;btn.disabled=false}};