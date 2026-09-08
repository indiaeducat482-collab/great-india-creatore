```javascript
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const $ = (id) => document.getElementById(id);

let currentUser = null;
let unsubscribeVideo = null;


/* =========================================
   LOGIN CHECK
========================================= */

onAuthStateChanged(auth, (user) => {

  currentUser = user;

  if (!user) {
    window.location.href = "login.html";
  }

});


/* =========================================
   HTML ESCAPE
========================================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================
   COMPRESS SCREENSHOT
========================================= */

function compressImage(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = function () {

      const img = new Image();

      img.onload = function () {

        let width = img.width;
        let height = img.height;

        const maxWidth = 1280;
        const maxHeight = 900;

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

        const canvas =
          document.createElement("canvas");

        canvas.width =
          Math.round(width);

        canvas.height =
          Math.round(height);

        const ctx =
          canvas.getContext("2d");

        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        let quality = 0.70;

        let dataUrl =
          canvas.toDataURL(
            "image/jpeg",
            quality
          );

        while (
          dataUrl.length > 900000 &&
          quality > 0.35
        ) {

          quality -= 0.05;

          dataUrl =
            canvas.toDataURL(
              "image/jpeg",
              quality
            );

        }

        if (dataUrl.length > 950000) {

          reject(
            new Error(
              "Screenshot बहुत बड़ा है। छोटा screenshot upload करें।"
            )
          );

          return;
        }

        resolve(dataUrl);

      };

      img.onerror = function () {

        reject(
          new Error(
            "Screenshot पढ़ा नहीं जा सका।"
          )
        );

      };

      img.src = reader.result;

    };

    reader.onerror = function () {

      reject(
        new Error(
          "Screenshot read failed."
        )
      );

    };

    reader.readAsDataURL(file);

  });

}


/* =========================================
   DEFAULT STATUS MESSAGE
========================================= */

function defaultMessage(status) {

  const messages = {

    queued:
      "⏳ AI video job queue में है...",

    processing:
      "⚙️ Video processing शुरू हो रही है...",

    analyzing:
      "🔎 Website और screenshot analyze किए जा रहे हैं...",

    ai_script:
      "🧠 AI Hindi script बना रहा है...",

    script_ready:
      "✅ Hindi AI script तैयार है।",

    voice:
      "🎙️ Hindi AI voice बनाई जा रही है...",

    voice_ready:
      "✅ Hindi AI voice तैयार है।",

    video:
      "🎬 MP4 video बनाई जा रही है...",

    video_ready:
      "✅ MP4 video तैयार है।",

    uploading:
      "☁️ Video Firebase Storage पर upload हो रही है...",

    finalizing:
      "🔗 Download link तैयार किया जा रहा है...",

    ready:
      "🎉 Video पूरी तरह तैयार है!",

    error:
      "❌ Video processing में error आया।"

  };

  return (
    messages[status] ||
    "⚙️ Video processing हो रही है..."
  );

}


/* =========================================
   SHOW LIVE STATUS
========================================= */

function showStatus(
  status,
  progress,
  message
) {

  const box = $("videoStatus");

  if (!box) {
    return;
  }

  let percent =
    Number(progress);

  if (Number.isNaN(percent)) {
    percent = 0;
  }

  percent =
    Math.max(
      0,
      Math.min(
        100,
        percent
      )
    );

  const text =
    message ||
    defaultMessage(status);

  box.innerHTML = `
    <div class="video-progress-box">

      <div class="video-progress-top">
        <strong>${escapeHtml(text)}</strong>
        <strong>${percent}%</strong>
      </div>

      <div class="video-progress-track">
        <div
          class="video-progress-bar"
          style="width: ${percent}%;">
        </div>
      </div>

      <div class="video-progress-status">
        Status: ${escapeHtml(status || "processing")}
      </div>

    </div>
  `;

}


/* =========================================
   ADD PROGRESS CSS
========================================= */

function addProgressCSS() {

  if (document.getElementById("videoProgressCSS")) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "videoProgressCSS";

  style.textContent = `
    .video-progress-box {
      margin-top: 18px;
      padding: 18px;
      border-radius: 14px;
      background: #f7f8fc;
      border: 1px solid #e5e7eb;
    }

    .video-progress-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 15px;
    }

    .video-progress-track {
      width: 100%;
      height: 12px;
      background: #e5e7eb;
      border-radius: 999px;
      overflow: hidden;
    }

    .video-progress-bar {
      height: 100%;
      background: linear-gradient(
        90deg,
        #6366f1,
        #8b5cf6
      );
      border-radius: 999px;
      transition: width 0.5s ease;
    }

    .video-progress-status {
      margin-top: 10px;
      color: #6b7280;
      font-size: 13px;
    }

    .video-ready-box {
      margin-top: 20px;
      padding: 18px;
      border-radius: 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }

    .video-error-box {
      margin-top: 20px;
      padding: 18px;
      border-radius: 14px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
    }

    .video-download-button {
      display: inline-block;
      margin-top: 15px;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      background: #6366f1;
      color: white;
    }

    .video-preview {
      width: 100%;
      max-width: 900px;
      display: block;
      margin-top: 15px;
      border-radius: 14px;
      background: #000;
    }

    .video-script {
      margin-top: 18px;
      padding: 14px;
      background: #f7f8fc;
      border-radius: 10px;
      white-space: pre-wrap;
      line-height: 1.7;
    }
  `;

  document.head.appendChild(style);

}

addProgressCSS();


/* =========================================
   SHOW READY VIDEO
========================================= */

function showReadyVideo(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }

  const url =
    data.outputUrl;

  if (!url) {

    result.classList.remove("hidden");

    result.innerHTML = `
      <div class="video-error-box">
        <h2>⚠️ Video तैयार है</h2>
        <p>
          Video बन गई लेकिन download link नहीं मिला।
        </p>
      </div>
    `;

    return;
  }

  result.classList.remove("hidden");

  let scriptHtml = "";

  if (data.script) {

    scriptHtml = `
      <details style="margin-top:18px;">

        <summary style="cursor:pointer;font-weight:600;">
          📝 Generated Hindi Script
        </summary>

        <div class="video-script">
          ${escapeHtml(data.script)}
        </div>

      </details>
    `;

  }

  result.innerHTML = `
    <div class="video-ready-box">

      <h2>🎬 Your AI Video</h2>

      <p>
        ${escapeHtml(
          data.title ||
          "AI Website Video"
        )}
      </p>

      <video
        class="video-preview"
        controls
        playsinline
        src="${escapeHtml(url)}">
      </video>

      <a
        class="video-download-button"
        target="_blank"
        rel="noopener"
        href="${escapeHtml(url)}">
        ⬇️ Download Video
      </a>

      ${scriptHtml}

    </div>
  `;

}


/* =========================================
   SHOW ERROR
========================================= */

function showError(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }

  result.classList.remove("hidden");

  result.innerHTML = `
    <div class="video-error-box">

      <h2>❌ Video नहीं बन सकी</h2>

      <p>
        ${escapeHtml(
          data.error ||
          "Video processing failed."
        )}
      </p>

    </div>
  `;

}


/* =========================================
   BUTTON
========================================= */

const createButton =
  $("createVideoBtn");


if (createButton) {

  createButton.onclick =
    async function () {

      if (!currentUser) {

        alert(
          "पहले Login करें।"
        );

        return;
      }


      const siteUrl =
        $("siteUrl")?.value.trim() ||
        "";

      const imageFile =
        $("imageFile")?.files?.[0] ||
        null;

      const category =
        $("category")?.value ||
        "short";

      const language =
        $("language")?.value ||
        "hi-IN";

      const voice =
        $("voice")?.value ||
        "hi-IN-Neural2-A";

      const instruction =
        $("instruction")?.value.trim() ||
        "";


      if (!siteUrl && !imageFile) {

        showStatus(
          "error",
          0,
          "Website URL या screenshot दें।"
        );

        return;
      }


      createButton.disabled =
        true;

      createButton.textContent =
        "⏳ Creating...";


      const result =
        $("videoResult");

      if (result) {

        result.classList.add(
          "hidden"
        );

        result.innerHTML =
          "";

      }


      showStatus(
        "queued",
        5,
        "⏳ AI video job create हो रहा है..."
      );


      try {

        /* =========================
           SCREENSHOT
        ========================= */

        let imageDataUrl = "";


        if (imageFile) {

          showStatus(
            "processing",
            8,
            "📷 Screenshot तैयार किया जा रहा है..."
          );

          imageDataUrl =
            await compressImage(
              imageFile
            );

        }


        /* =========================
           FIRESTORE JOB CREATE
        ========================= */

        showStatus(
          "queued",
          5,
          "⏳ AI video job queue में भेजा जा रहा है..."
        );


        const docRef =
          await addDoc(
            collection(
              db,
              "videos"
            ),
            {

              userId:
                currentUser.uid,

              category:
                category,

              siteUrl:
                siteUrl,

              imageDataUrl:
                imageDataUrl,

              language:
                language,

              voice:
                voice,

              instruction:
                instruction,

              title:
                "AI Website Video",

              status:
                "queued",

              progress:
                5,

              progressMessage:
                "⏳ AI video job queue में है...",

              createdAt:
                serverTimestamp()

            }
          );


        console.log(
          "AI video job created:",
          docRef.id
        );


        /* =========================
           REMOVE OLD LISTENER
        ========================= */

        if (unsubscribeVideo) {

          unsubscribeVideo();

          unsubscribeVideo =
            null;

        }


        /* =========================
           REAL-TIME LISTENER
        ========================= */

        unsubscribeVideo =
          onSnapshot(
            docRef,

            function (snapshot) {

              if (!snapshot.exists()) {

                showStatus(
                  "error",
                  0,
                  "❌ Video job नहीं मिला।"
                );

                return;
              }


              const data =
                snapshot.data();


              console.log(
                "LIVE VIDEO STATUS:",
                data.status,
                data.progress,
                data.progressMessage
              );


              /* LIVE PROGRESS */

              showStatus(
                data.status,
                data.progress,
                data.progressMessage
              );


              /* =====================
                 READY
              ===================== */

              if (
                data.status ===
                "ready"
              ) {

                showStatus(
                  "ready",
                  100,
                  "🎉 Video पूरी तरह तैयार है!"
                );


                showReadyVideo(
                  data
                );


                createButton.disabled =
                  false;

                createButton.textContent =
                  "✨ Generate AI Video";


                if (unsubscribeVideo) {

                  unsubscribeVideo();

                  unsubscribeVideo =
                    null;

                }

                return;
              }


              /* =====================
                 ERROR
              ===================== */

              if (
                data.status ===
                "error"
              ) {

                showStatus(
                  "error",
                  0,
                  data.progressMessage ||
                  "❌ Video processing failed."
                );


                showError(
                  data
                );


                createButton.disabled =
                  false;

                createButton.textContent =
                  "✨ Generate AI Video";


                if (unsubscribeVideo) {

                  unsubscribeVideo();

                  unsubscribeVideo =
                    null;

                }

              }

            },

            function (error) {

              console.error(
                "Video listener error:",
                error
              );


              showStatus(
                "error",
                0,
                "❌ Live status error: " +
                error.message
              );


              createButton.disabled =
                false;

              createButton.textContent =
                "✨ Generate AI Video";

            }
          );


      } catch (error) {

        console.error(
          "VIDEO CREATE ERROR:",
          error
        );


        showStatus(
          "error",
          0,
          "❌ " +
          (
            error.message ||
            "AI job create failed."
          )
        );


        createButton.disabled =
          false;

        createButton.textContent =
          "✨ Generate AI Video";

      }

    };

}
```
