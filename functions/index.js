const {onDocumentCreated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getStorage}=require("firebase-admin/storage");
const {GoogleGenerativeAI}=require("@google/generative-ai");
const textToSpeech=require("@google-cloud/text-to-speech");
const PptxGenJS=require("pptxgenjs");
const {execFile}=require("child_process");
const fs=require("fs"),path=require("path"),os=require("os"),crypto=require("crypto");
initializeApp();const db=getFirestore();const bucket=getStorage().bucket();

async function aiText(prompt){const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_API_KEY is not configured in Functions secrets.");const gen=new GoogleGenerativeAI(key);const model=gen.getGenerativeModel({model:"gemini-2.5-flash"});const r=await model.generateContent(prompt);return r.response.text();}

exports.videoJobCreated=onDocumentCreated({document:"videos/{videoId}",region:"asia-south1",timeoutSeconds:540,memory:"1GiB"},async event=>{
 const snap=event.data, d=snap.data(); if(!d)return;
 try{
  await snap.ref.update({status:"processing"});
  let page="";if(d.siteUrl){const r=await fetch(d.siteUrl,{redirect:"follow"});page=(await r.text()).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,30000)}
  const prompt=`Create a ${d.category==="short"?"45-60 second":"2-4 minute"} Hindi explanatory video narration for this website/portal. Explain its purpose, main services, user flow and important features step-by-step. Be accurate and do not invent features not supported by the page. Extra instruction: ${d.instruction||"None"}. Website text: ${page||"No website text; use uploaded screenshot context if available."} Return ONLY natural Hindi narration.`;
  const script=await aiText(prompt);
  const tts=new textToSpeech.TextToSpeechClient();
  const [speech]=await tts.synthesizeSpeech({input:{text:script},voice:{languageCode:"hi-IN",name:"hi-IN-Neural2-A"},audioConfig:{audioEncoding:"MP3",speakingRate:1.0}});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gic-"));const audio=path.join(dir,"voice.mp3"),out=path.join(dir,"video.mp4");fs.writeFileSync(audio,speech.audioContent);
  // Create a simple branded explanatory video: title card + Hindi voice. This is a real MP4 artifact; richer screenshots/scenes can be added later.
  const ff= require("ffmpeg-static");await new Promise((resolve,reject)=>execFile(ff,["-f","lavfi","-i","color=c=0x17142d:s=1280x720:r=30","-i",audio,"-vf","drawtext=text='Great India Creator':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=280,drawtext=text='AI Website Explanatory Video':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=360","-c:v","libx264","-c:a","aac","-shortest","-pix_fmt","yuv420p",out],{timeout:500000},(e)=>e?reject(e):resolve()));
  const dest=`generated/${d.userId}/videos/${event.params.videoId}.mp4`;await bucket.upload(out,{destination:dest,metadata:{contentType:"video/mp4",metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}}});
  const token=(await bucket.file(dest).getMetadata())[0].metadata.firebaseStorageDownloadTokens;const outputUrl=`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
  await snap.ref.update({status:"ready",script,outputUrl,updatedAt:new Date()});
 }catch(e){console.error(e);await snap.ref.update({status:"error",error:e.message,updatedAt:new Date()})}
});

exports.pptJobCreated=onDocumentCreated({document:"presentations/{presentationId}",region:"asia-south1",timeoutSeconds:540,memory:"1GiB"},async event=>{
 const snap=event.data,d=snap.data();if(!d)return;
 try{await snap.ref.update({status:"processing"});const prompt=`Convert these study notes into a clean PPT outline. Title: ${d.title}. ${d.instruction||""}\nReturn JSON array only, each item {title,bullets:[...]} with one topic per slide. Notes:\n${d.sourceText||""}`;let raw=await aiText(prompt);raw=raw.replace(/^```json|```$/g,"").trim();const slides=JSON.parse(raw);
 const ppt=new PptxGenJS();ppt.layout="LAYOUT_WIDE";ppt.author="Great India Creator";slides.forEach((s,i)=>{const slide=ppt.addSlide();slide.background={color:"F7F8FC"};slide.addText(s.title||`Topic ${i+1}`,{x:.7,y:.5,w:12,h:.6,fontSize:28,bold:true,color:"5B45E6"});slide.addText((s.bullets||[]).map(x=>({text:String(x),options:{bullet:{indent:14}}})),{x:1,y:1.5,w:11,h:5,fontSize:20,color:"172033",breakLine:false,fit:"shrink"});});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gic-ppt-")),out=path.join(dir,`${event.params.presentationId}.pptx`);await ppt.writeFile({fileName:out});const dest=`generated/${d.userId}/ppt/${event.params.presentationId}.pptx`;await bucket.upload(out,{destination:dest,metadata:{contentType:"application/vnd.openxmlformats-officedocument.presentationml.presentation"}});const [meta]=await bucket.file(dest).getMetadata();const token=meta.metadata?.firebaseStorageDownloadTokens||crypto.randomUUID();if(!meta.metadata?.firebaseStorageDownloadTokens)await bucket.file(dest).setMetadata({metadata:{firebaseStorageDownloadTokens:token}});const outputUrl=`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;await snap.ref.update({status:"ready",slideCount:slides.length,outputUrl,updatedAt:new Date()});
 }catch(e){console.error(e);await snap.ref.update({status:"error",error:e.message,updatedAt:new Date()})}
});