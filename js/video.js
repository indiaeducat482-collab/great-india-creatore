import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { addDoc, collection, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
let currentUser = null;
let stopListening = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "login.html";
  }
});

function setStatus(status, progress, message) {
  const box = $("videoStatus");
  if (!box) return;

  let p = Number(progress);
  if (!Number.isFinite(p)) p = 0;
  p = Math.max(0, Math.min(100, p));

  box.innerHTML =
    '<div style="margin-top:16px;padding:15px;border:1px solid #ddd;border-radius:12px;background:#f8f9fa">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:9px">' +
        '<b>' + (message || "AI video processing...") + '</b>' +
        '<b>' + p + '%</b>' +
      '</div>' +
      '<div style="height:12px;background:#ddd;border-radius:20px;overflow:hidden">' +
        '<div style="width:' + p + '%;height:100%;background:#635bff;transition:width .4s"></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:13px;color:#666">Status: ' + (status || "processing") + '</div>' +
    '</div>';
}

function showReady(data) {
  const box = $("videoResult");
  if (!box) return;

  box.classList.remove("hidden");

  if (!data.outputUrl) {
    box.innerHTML =
      '<div style="padding:16px;border:1px solid #f0c36d;border-radius:12px">' +
      '<h2>Video तैयार है</h2><p>Download URL अभी उपलब्ध नहीं है।</p></div>';
    return;
  }

  const title = data.title || "AI Website Video";

  box.innerHTML =
    '<div style="padding:16px;border:1px solid #b7e4c7;border-radius:14px;background:#f0fff4">' +
      '<h2>🎬 ' + title + '</h2>' +
      '<video controls playsinline style="width:100%;max-width:900px;border-radius:12px;background:#000" src="' + data.outputUrl + '"></video>' +
      '<p style="margin-top:15px"><a class="primary" target="_blank" rel="noopener" href="' + data.outputUrl + '">⬇️ Download Video</a></p>' +
    '</div>';
}

function showError(message) {
  const box = $("videoResult");
  if (!box) return;

  box.classList.remove("hidden");
  box.innerHTML =
    '<div style="padding:16px;border:1px solid #f5b5b5;border-radius:12px;background:#fff1f1">' +
      '<h2>❌ Video नहीं बन सकी</h2><p>' + (message || "Unknown error") + '</p></div>';
}

const button = $("createVideoBtn");

if (button) {
  button.addEventListener("click", async () => {
    if (!currentUser) {
      alert("पहले Login करें।");
      return;
    }

    const siteUrl = $("siteUrl") ? $("siteUrl").value.trim() : "";
    const imageFile = $("imageFile") && $("imageFile").files ? $("imageFile").files[0] : null;
    const category = $("category") ? $("category").value : "short";
    const language = $("language") ? $("language").value : "hi-IN";
    const voice = $("voice") ? $("voice").value : "hi-IN-SwaraNeural";
    const instruction = $("instruction") ? $("instruction").value.trim() : "";

    if (!siteUrl && !imageFile) {
      setStatus("error", 0, "Website URL या screenshot दें।");
      return;
    }

    button.disabled = true;
    button.textContent = "⏳ Creating...";
    setStatus("queued", 5, "⏳ AI video job create हो रहा है...");

    const result = $("videoResult");
    if (result) {
      result.classList.add("hidden");
      result.innerHTML = "";
    }

    try {
      /*
       * IMPORTANT:
       * Screenshot is NOT uploaded from the browser to Firebase Storage.
       * This avoids the previous Firebase Storage CORS problem.
       */
      let imageDataUrl = "";

      if (imageFile) {
        setStatus("processing", 8, "📷 Screenshot पढ़ा जा रहा है...");

        imageDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            const img = new Image();

            img.onload = () => {
              let width = img.width;
              let height = img.height;
              const maxWidth = 1200;
              const maxHeight = 800;

              if (width > maxWidth) {
                const ratio = maxWidth / width;
                width = maxWidth;
                height = height * ratio;
              }

              if (height > maxHeight) {
                const ratio = maxHeight / height;
                height = maxHeight;
                width = width * ratio;
              }

              const canvas = document.createElement("canvas");
              canvas.width = Math.round(width);
              canvas.height = Math.round(height);

              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              let quality = 0.65;
              let data = canvas.toDataURL("image/jpeg", quality);

              while (data.length > 850000 && quality > 0.30) {
                quality -= 0.05;
                data = canvas.toDataURL("image/jpeg", quality);
              }

              if (data.length > 950000) {
                reject(new Error("Screenshot बहुत बड़ा है। छोटा screenshot upload करें।"));
                return;
              }

              resolve(data);
            };

            img.onerror = () => reject(new Error("Screenshot पढ़ा नहीं जा सका।"));
            img.src = reader.result;
          };

          reader.onerror = () => reject(new Error("Screenshot read failed."));
          reader.readAsDataURL(imageFile);
        });
      }

      setStatus("queued", 5, "⏳ AI video job queue में भेजा जा रहा है...");

      const docRef = await addDoc(collection(db, "videos"), {
        userId: currentUser.uid,
        category: category,
        siteUrl: siteUrl,
        imageDataUrl: imageDataUrl,
        language: language,
        voice: voice,
        instruction: instruction,
        title: "AI Website Video",
        status: "queued",
        progress: 5,
        progressMessage: "⏳ AI video job queue में है...",
        createdAt: serverTimestamp()
      });

      console.log("AI VIDEO JOB CREATED:", docRef.id);

      if (stopListening) {
        stopListening();
        stopListening = null;
      }

      stopListening = onSnapshot(
        docRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setStatus("error", 0, "❌ Video job नहीं मिला।");
            return;
          }

          const data = snapshot.data();

          setStatus(
            data.status || "processing",
            data.progress == null ? 0 : data.progress,
            data.progressMessage || "AI video processing हो रही है..."
          );

          if (data.status === "ready") {
            setStatus("ready", 100, "🎉 Video पूरी तरह तैयार है!");
            showReady(data);
            button.disabled = false;
            button.textContent = "✨ Generate AI Video";

            if (stopListening) {
              stopListening();
              stopListening = null;
            }
          }

          if (data.status === "error") {
            const errorText = data.error || data.progressMessage || "Video processing failed.";
            setStatus("error", 0, "❌ " + errorText);
            showError(errorText);
            button.disabled = false;
            button.textContent = "✨ Generate AI Video";

            if (stopListening) {
              stopListening();
              stopListening = null;
            }
          }
        },
        (error) => {
          console.error("VIDEO STATUS ERROR:", error);
          setStatus("error", 0, "❌ Live status error: " + error.message);
          button.disabled = false;
          button.textContent = "✨ Generate AI Video";
        }
      );
    } catch (error) {
      console.error("CREATE VIDEO ERROR:", error);
      setStatus("error", 0, "❌ " + (error.message || "AI job create failed."));
      button.disabled = false;
      button.textContent = "✨ Generate AI Video";
    }
  });
}
