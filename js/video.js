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


/* =========================================
   HELPERS
========================================= */

const $ = (id) => document.getElementById(id);

let currentUser = null;
let unsubscribeVideo = null;


/* =========================================
   AUTH
========================================= */

onAuthStateChanged(auth, (user) => {

  currentUser = user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

});


/* =========================================
   SCREENSHOT COMPRESS
   Firestore document 1 MiB से छोटा रखने के लिए
========================================= */

function compressImage(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const img = new Image();

      img.onload = () => {

        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 900;

        let width = img.width;
        let height = img.height;


        /* Resize */

        if (width > MAX_WIDTH) {

          const ratio =
            MAX_WIDTH / width;

          width =
            MAX_WIDTH;

          height =
            height * ratio;
        }


        if (height > MAX_HEIGHT) {

          const ratio =
            MAX_HEIGHT / height;

          height =
            MAX_HEIGHT;

          width =
            width * ratio;
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


        /*
         * JPEG quality कम रखकर
         * Firestore size सुरक्षित रखते हैं
         */

        let quality = 0.70;

        let dataUrl =
          canvas.toDataURL(
            "image/jpeg",
            quality
          );


        /*
         * लगभग 900KB से ज्यादा न जाने दें
         */

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
              "Screenshot बहुत बड़ा है। कृपया छोटा screenshot upload करें।"
            )
          );

          return;
        }


        resolve(dataUrl);

      };


      img.onerror = () => {

        reject(
          new Error(
            "Screenshot read नहीं हो सका।"
          )
        );

      };


      img.src =
        reader.result;
    };


    reader.onerror = () => {

      reject(
        new Error(
          "Screenshot upload/read failed."
        )
      );

    };


    reader.readAsDataURL(file);

  });

}


/* =========================================
   STATUS UI
========================================= */

function showStatus(
  status,
  progress,
  message
) {

  const statusBox =
    $("videoStatus");

  if (!statusBox) {
    return;
  }


  let safeProgress =
    Number(progress);

  if (
    Number.isNaN(safeProgress)
  ) {
    safeProgress = 0;
  }


  safeProgress =
    Math.max(
      0,
      Math.min(
        100,
        safeProgress
      )
    );


  const statusText =
    message ||
    getDefaultStatus(status);


  statusBox.innerHTML = `

    <div style="
      margin-top:18px;
      padding:18px;
      border-radius:14px;
      background:#f7f8fc;
      border:1px solid #e5e7eb;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:10px;
      ">

        <strong style="font-size:16px;">
          ${escapeHtml(statusText)}
        </strong>

        <strong style="font-size:16px;">
          ${safeProgress}%
        </strong>

      </div>


      <div style="
        width:100%;
        height:12px;
        background:#e5e7eb;
        border-radius:999px;
        overflow:hidden;
      ">

        <div style="
          width:${safeProgress}%;
          height:100%;
          background:linear-gradient(
            90deg,
            #6366f1,
            #8b5cf6
          );
          border-radius:999px;
          transition:width .5s ease;
        "></div>

      </div>


      <div style="
        margin-top:10px;
        font-size:13px;
        color:#6b7280;
      ">
        Status: ${escapeHtml(status || "processing")}
      </div>

    </div>

  `;

}


/* =========================================
   DEFAULT STATUS
========================================= */

function getDefaultStatus(status) {

  const statuses = {

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
    statuses[status] ||
    "⚙️ Video processing हो रही है..."
  );
}


/* =========================================
   HTML ESCAPE
========================================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================
   READY RESULT
========================================= */

function showVideoResult(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }


  const outputUrl =
    data.outputUrl;


  if (!outputUrl) {

    result.classList.remove(
      "hidden"
    );

    result.innerHTML = `

      <h2>⚠️ Video तैयार है</h2>

      <p>
        Video processing complete हो गई,
        लेकिन download link अभी नहीं मिला।
      </p>

    `;

    return;
  }


  result.classList.remove(
    "hidden"
  );


  result.innerHTML = `

    <h2>🎬 Your AI Video</h2>

    <p style="
      margin:8px 0 16px;
      color:#6b7280;
    ">
      ${escapeHtml(
        data.title ||
        "AI Website Video"
      )}
    </p>


    <video
      controls
      playsinline
      style="
        width:100%;
        max-width:900px;
        border-radius:14px;
        display:block;
        background:#000;
      "
      src="${escapeHtml(outputUrl)}">
    </video>


    <div style="
      margin-top:16px;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    ">

      <a
        class="primary"
        target="_blank"
        rel="noopener"
        href="${escapeHtml(outputUrl)}"
        style="
          display:inline-block;
          text-decoration:none;
          padding:12px 18px;
          border-radius:10px;
        "
      >
        ⬇️ Download Video
      </a>

    </div>


    ${
      data.script
        ? `
          <details style="
            margin-top:20px;
          ">

            <summary
              style="
                cursor:pointer;
                font-weight:600;
              "
            >
              📝 Generated Hindi Script
            </summary>

            <div style="
              margin-top:12px;
              padding:14px;
              background:#f7f8fc;
              border-radius:10px;
              white-space:pre-wrap;
              line-height:1.7;
            ">
              ${escapeHtml(data.script)}
            </div>

          </details>
        `
        : ""
    }

  `;

}


/* =========================================
   ERROR RESULT
========================================= */

function showVideoError(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }


  result.classList.remove(
    "hidden"
  );


  result.innerHTML = `

    <div style="
      padding:18px;
      border-radius:14px;
      background:#fff1f2;
      border:1px solid #fecdd3;
    ">

      <h2>
        ❌ Video नहीं बन सकी
      </h2>

      <p style="
        color:#991b1b;
        line-height:1.6;
      ">
        ${escapeHtml(
          data.error ||
          "Unknown processing error"
        )}
      </p>

    </div>

  `;

}


/* =========================================
   CREATE VIDEO
========================================= */

const createButton =
  $("createVideoBtn");


if (createButton) {

  createButton.onclick =
    async () => {

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


      createButton.style.opacity =
        "0.6";


      createButton.textContent =
        "⏳ Creating AI Job...";


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

        let imageDataUrl =
          "";


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
           FIRESTORE JOB
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

              category,

              siteUrl,

              imageDataUrl,

              language,

              voice,

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
          "Video job created:",
          docRef.id
        );


        showStatus(
          "queued",
          5,
          "⏳ AI job create हो गया। Processing शुरू होने का इंतजार है..."
        );


        /*
         * पुराने listener को बंद करें
         */

        if (
          unsubscribeVideo
        ) {

          unsubscribeVideo();

          unsubscribeVideo =
            null;
        }


        /* =========================
           REAL-TIME FIRESTORE LISTENER
        ========================= */

        unsubscribeVideo =
          onSnapshot(
            docRef,

            (snapshot) => {

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
                "VIDEO STATUS:",
                data.status,
                data.progress,
                data.progressMessage
              );


              /* =====================
                 LIVE STATUS
              ===================== */

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
                  data.progressMessage ||
                  "🎉 Video पूरी तरह तैयार है!"
                );


                showVideoResult(
                  data
                );


                createButton.disabled =
                  false;

                createButton.style.opacity =
                  "1";

                createButton.textContent =
                  "✨ Generate AI Video";


                if (
                  unsubscribeVideo
                ) {

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


                showVideoError(
                  data
                );


                createButton.disabled =
                  false;

                createButton.style.opacity =
                  "1";

                createButton.textContent =
                  "✨ Generate AI Video";


                if (
                  unsubscribeVideo
                ) {

                  unsubscribeVideo();

                  unsubscribeVideo =
                    null;
                }

              }

            },

            (error) => {

              console.error(
                "Firestore listener error:",
                error
              );


              showStatus(
                "error",
                0,
                "❌ Live status पढ़ने में error: " +
                error.message
              );


              createButton.disabled =
                false;

              createButton.style.opacity =
                "1";

              createButton.textContent =
                "✨ Generate AI Video";

            }
          );


      } catch (error) {

        console.error(
          "CREATE VIDEO ERROR:",
          error
        );


        showStatus(
          "error",
          0,
          "❌ " +
          (
            error?.message ||
            "AI video job create failed."
          )
        );


        createButton.disabled =
          false;

        createButton.style.opacity =
          "1";

        createButton.textContent =
          "✨ Generate AI Video";

      }

    };

}
```
