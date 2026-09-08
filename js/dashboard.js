import {auth,db} from "./firebase.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {doc,getDoc,collection,query,where,orderBy,getDocs} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const $=id=>document.getElementById(id);
async function load(u){$("userEmail").textContent=u.email||"";$("hello").textContent=`Hello, ${u.displayName||"Creator"} 👋`;
 try{const s=await getDoc(doc(db,"users",u.uid));$("videoCredits").textContent=s.exists()?(s.data().videoCredits??2):2}catch{}
 const list=$("historyList");list.innerHTML="";
 try{const qs=query(collection(db,"videos"),where("userId","==",u.uid),orderBy("createdAt","desc"));const snap=await getDocs(qs);if(snap.empty){list.innerHTML='<p class="muted">अभी कोई video नहीं बना है.</p>'}else snap.forEach(d=>{const x=d.data();list.insertAdjacentHTML("beforeend",`<div class="historyItem"><b>🎬 ${x.title||"AI Video"}</b><br><small>${x.status||"queued"} ${x.outputUrl?`• <a target="_blank" href="${x.outputUrl}">Download</a>`:""}</small></div>`)})}catch(e){list.innerHTML='<p class="muted">History loading issue. Firestore index बनने के बाद फिर देखें.</p>'}}
onAuthStateChanged(auth,u=>u?load(u):location.href="login.html");
$("logoutBtn").onclick=()=>signOut(auth).then(()=>location.href="login.html");
$("refreshHistory").onclick=()=>{if(auth.currentUser)load(auth.currentUser)};