import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
let currentUser=null; onAuthStateChanged(auth,u=>{currentUser=u;if(!u)location.href="login.html";});
document.getElementById("createVideoBtn")?.addEventListener("click",async()=>{
 try{
  if(!currentUser)return;
  const profile=(await getDoc(doc(db,"users",currentUser.uid))).data();
  if(!profile?.premium && (profile?.videoCredits??0)<=0) return alert("Video credits finished. Premium required.");
  const f=document.getElementById("imageFile").files[0]; let path="";
  if(f){path=`uploads/${currentUser.uid}/${Date.now()}_${f.name}`;await uploadBytes(ref(storage,path),f);}
  const v={uid:currentUser.uid,category:document.getElementById("category").value,siteUrl:document.getElementById("siteUrl").value.trim(),imagePath:path,language:"Hindi",voice:"Hindi AI Voice",instruction:document.getElementById("instruction").value.trim(),status:"queued",createdAt:new Date().toISOString()};
  await addDoc(collection(db,"videos"),v);
  if(!profile.premium)await updateDoc(doc(db,"users",currentUser.uid),{videoCredits:increment(-1)});
  document.getElementById("videoStatus").textContent="AI video job queued.";
 }catch(e){alert(e.message);}
});