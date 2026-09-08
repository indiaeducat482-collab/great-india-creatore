const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp(); const db=getFirestore();
exports.videoJobCreated=onDocumentCreated("videos/{videoId}",async event=>{await db.doc(`videos/${event.params.videoId}`).update({status:"backend_ready"});});
exports.pptJobCreated=onDocumentCreated("ppts/{pptId}",async event=>{await db.doc(`ppts/${event.params.pptId}`).update({status:"backend_ready"});});