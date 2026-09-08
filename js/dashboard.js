import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
onAuthStateChanged(auth, async user => {
  if(!user) return location.href="login.html";
  const snap=await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()) return;
  const p=snap.data(); document.getElementById("userInfo").textContent=`Welcome, ${p.name||user.email}`;
  document.getElementById("videoCredits").textContent=p.premium?"Premium":(p.videoCredits??0);
  if(p.role==="admin") document.getElementById("adminLink").classList.remove("hidden");
});
document.getElementById("logoutBtn")?.addEventListener("click",()=>signOut(auth).then(()=>location.href="login.html"));