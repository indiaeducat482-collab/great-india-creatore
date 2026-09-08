import {auth,db,storage} from "./firebase.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {addDoc,collection,serverTimestamp,onSnapshot} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {ref,uploadBytes,getDownloadURL} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
const $=id=>document.getElementById(id);let user;
onAuthStateChanged(auth,u=>{user=u;if(!u)location.href="login.html"});
$("createVideoBtn").onclick=async()=>{
 if(!user)return;const url=$("siteUrl").value.trim();const f=$("imageFile").files[0];if(!url&&!f){$("videoStatus").textContent="Website URL या screenshot दें.";return}
 const btn=$("createVideoBtn");btn.disabled=true;$("videoStatus").textContent="AI job create हो रहा है…";
 try{
  let imageUrl="";if(f){const r=ref(storage,`uploads/${user.uid}/video/${Date.now()}-${f.name}`);await uploadBytes(r,f);imageUrl=await getDownloadURL(r)}
  const docRef=await addDoc(collection(db,"videos"),{userId:user.uid,category:$("category").value,siteUrl:url,imageUrl,language:$("language").value,voice:$("voice").value,instruction:$("instruction").value.trim(),status:"queued",title:"AI Website Video",createdAt:serverTimestamp()});
  $("videoStatus").textContent="Queued. AI script + Hindi voice + video processing backend में चलेगा…";
  const unsub=onSnapshot(docRef,s=>{const d=s.data();if(!d)return;if(d.status==="ready"){unsub();$("videoStatus").textContent="✅ Video तैयार है!";$("videoResult").classList.remove("hidden");$("videoResult").innerHTML=`<h2>🎬 Your AI Video</h2><p>${d.title||""}</p><video controls style="width:100%;border-radius:12px" src="${d.outputUrl}"></video><p><a class="primary" target="_blank" href="${d.outputUrl}">Download Video</a></p>`}else if(d.status==="error"){unsub();$("videoStatus").textContent="❌ "+(d.error||"Video processing failed");}});
 }catch(e){$("videoStatus").textContent="❌ "+e.message;btn.disabled=false}
};