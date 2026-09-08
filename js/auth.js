import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
$("signupBtn")?.addEventListener("click", async () => {
  try {
    const name=$("name").value.trim(), email=$("email").value.trim(), password=$("password").value;
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,name,email,role:"user",videoCredits:2,premium:false,createdAt:new Date().toISOString()});
    location.href="dashboard.html";
  } catch(e){ alert(e.message); }
});
$("loginBtn")?.addEventListener("click", async () => {
  try { await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value); location.href="dashboard.html"; }
  catch(e){ alert(e.message); }
});