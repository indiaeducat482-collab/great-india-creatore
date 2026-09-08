import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
let currentUser=null; onAuthStateChanged(auth,u=>{currentUser=u;if(!u)location.href="login.html";});
document.getElementById("createPptBtn")?.addEventListener("click",async()=>{
 try{
  if(!currentUser)return; const files=[...document.getElementById("notesFiles").files]; if(!files.length)return alert("PDF/image select करें.");
  const paths=[]; for(const f of files){const p=`uploads/${currentUser.uid}/${Date.now()}_${f.name}`;await uploadBytes(ref(storage,p),f);paths.push(p);}
  await addDoc(collection(db,"ppts"),{uid:currentUser.uid,inputPaths:paths,status:"queued",createdAt:new Date().toISOString()});
  document.getElementById("pptStatus").textContent="AI PPT job queued.";
 }catch(e){alert(e.message);}
});