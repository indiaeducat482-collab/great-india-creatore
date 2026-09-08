import {auth,db} from "./firebase.js";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,updateProfile} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {doc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const msg=document.querySelector("#msg");
const show=e=>msg.textContent=e?.message?.replace("Firebase: ","")||"Something went wrong.";
document.querySelector("#signupBtn")?.addEventListener("click",async()=>{
 const name=document.querySelector("#name").value.trim(),email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value;
 if(!name||!email||password.length<6){msg.textContent="Name, valid email और कम से कम 6 character password दें.";return}
 try{const c=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(c.user,{displayName:name});await setDoc(doc(db,"users",c.user.uid),{uid:c.user.uid,name,email,plan:"free",videoCredits:2,createdAt:serverTimestamp()});location.href="dashboard.html"}catch(e){show(e)}
});
document.querySelector("#loginBtn")?.addEventListener("click",async()=>{
 const email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value;
 try{await signInWithEmailAndPassword(auth,email,password);location.href="dashboard.html"}catch(e){show(e)}
});