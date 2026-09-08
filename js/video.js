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
let stopListener = null;


/* ================================
   LOGIN
================================ */

onAuthStateChanged(auth, function (user) {

  currentUser = user;

  if (!user) {
    location.href = "login.html";
  }

});


/* ================================
   IMAGE COMPRESS
================================ */

function compressImage(file) {

  return new Promise(function (resolve, reject) {

    const reader = new FileReader();

    reader.onload = function () {

      const image = new Image();

      image.onload = function () {

        let width = image.width;
        let height = image.height;

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
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        let quality = 0.65;

        let result =
          canvas.toDataURL(
            "image/jpeg",
            quality
          );

        while (
          result.length > 850000 &&
          quality > 0.30
        ) {

          quality -= 0.05;

          result =
            canvas.toDataURL(
              "image/jpeg",
              quality
            );

        }

        if (result.length > 950000) {

          reject(
            new Error(
              "Screenshot बहुत बड़ा है। छोटा screenshot upload करें।"
            )
          );

          return;
        }

        resolve(result);

      };

      image.onerror = function () {

        reject(
          new Error(
            "Screenshot पढ़ा नहीं जा सका।"
          )
        );

      };

      image.src = reader.result;

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


/* ================================
   STATUS MESSAGE
================================ */

function getMessage(status) {

  if (status === "queued") {
    return "⏳ AI video job queue में है...";
  }

  if (status === "processing") {
    return "⚙️ Video processing शुरू हो रही है...";
  }

  if (status === "analyzing") {
    return "🔎 Website और screenshot analyze किए जा रहे हैं...";
  }

  if (status === "ai_script") {
    return "🧠 AI Hindi script बना रहा है...";
  }

  if (status === "script_ready") {
    return "✅ Hindi AI script तैयार है।";
  }

  if (status === "voice") {
    return "🎙️ Hindi AI voice बनाई जा रही है...";
  }

  if (status === "voice_ready") {
    return "✅ Hindi AI voice तैयार है।";
  }

  if (status === "video") {
    return "🎬 MP4 video बनाई जा रही है...";
  }

  if (status === "video_ready") {
    return "✅ MP4 video तैयार है।";
  }

  if (status === "uploading") {
    return "☁️ Video Firebase Storage पर upload हो रही है...";
  }

  if (status === "finalizing") {
    return "🔗 Download link तैयार किया जा रहा है...";
  }

  if (status === "ready") {
    return "🎉 Video पूरी तरह तैयार है!";
  }

  if (status === "error") {
    return "❌ Video processing में error आया।";
  }

  return "⚙️ Video processing हो रही है...";

}


/* ================================
   STATUS DISPLAY
================================ */

function showStatus(
  status,
  progress,
  message
) {

  const box = $("videoStatus");

  if (!box) {
    return;
  }

  let percent = Number(progress);

  if (Number.isNaN(percent)) {
    percent = 0;
  }

  if (percent < 0) {
    percent = 0;
  }

  if (percent > 100) {
    percent = 100;
  }

  const text =
    message ||
    getMessage(status);


  box.innerHTML =
    '<div style="margin-top:18px;padding:18px;border-radius:14px;background:#f7f8fc;border:1px solid #e5e7eb;">' +

      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +

        '<strong>' +
          text +
        '</strong>' +

        '<strong>' +
          percent +
          '%' +
        '</strong>' +

      '</div>' +

      '<div style="width:100%;height:12px;background:#e5e7eb;border-radius:20px;overflow:hidden;">' +

        '<div style="height:100%;width:' +
          percent +
          '%;background:#6366f1;border-radius:20px;transition:width .5s;">' +
        '</div>' +

      '</div>' +

      '<div style="margin-top:10px;font-size:13px;color:#666;">' +

        'Status: ' +
        (status || "processing") +

      '</div>' +

    '</div>';

}


/* ================================
   READY VIDEO
================================ */

function showReady(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }

  const url =
    data.outputUrl;

  result.classList.remove("hidden");

  if (!url) {

    result.innerHTML =
      '<div style="padding:18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">' +
        '<h2>⚠️ Video तैयार है</h2>' +
        '<p>लेकिन download link नहीं मिला।</p>' +
      '</div>';

    return;
  }


  let scriptPart = "";

  if (data.script) {

    scriptPart =
      '<details style="margin-top:18px;">' +

        '<summary style="cursor:pointer;font-weight:bold;">' +
          '📝 Hindi Script' +
        '</summary>' +

        '<div style="margin-top:10px;padding:14px;background:#f7f8fc;border-radius:10px;white-space:pre-wrap;">' +
          data.script +
        '</div>' +

      '</details>';

  }


  result.innerHTML =
    '<div style="padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">' +

      '<h2>🎬 Your AI Video</h2>' +

      '<p>' +
        (data.title || "AI Website Video") +
      '</p>' +

      '<video controls playsinline style="width:100%;max-width:900px;border-radius:14px;background:#000;">' +
        '<source src="' +
          url +
        '" type="video/mp4">' +
      '</video>' +

      '<br>' +

      '<a href="' +
        url +
        '" target="_blank" rel="noopener" class="primary">' +
        '⬇️ Download Video' +
      '</a>' +

      scriptPart +

    '</div>';

}


/* ================================
   ERROR
================================ */

function showError(data) {

  const result =
    $("videoResult");

  if (!result) {
    return;
  }

  result.classList.remove("hidden");

  result.innerHTML =
    '<div style="padding:18px;background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;">' +

      '<h2>❌ Video नहीं बन सकी</h2>' +

      '<p>' +
        (data.error || "Video processing failed.") +
      '</p>' +

    '</div>';

}


/* ================================
   CREATE BUTTON
================================ */

const button =
  $("createVideoBtn");


if (button) {

  button.onclick =
    async function () {

      if (!currentUser) {

        alert("पहले Login करें।");

        return;
      }


      const siteUrl =
        $("siteUrl")
          ? $("siteUrl").value.trim()
          : "";


      const imageFile =
        $("imageFile") &&
        $("imageFile").files
          ? $("imageFile").files[0]
          : null;


      const category =
        $("category")
          ? $("category").value
          : "short";


      const language =
        $("language")
          ? $("language").value
          : "hi-IN";


      const voice =
        $("voice")
          ? $("voice").value
          : "hi-IN-Neural2-A";


      const instruction =
        $("instruction")
          ? $("instruction").value.trim()
          : "";


      if (!siteUrl && !imageFile) {

        showStatus(
          "error",
          0,
          "Website URL या screenshot दें।"
        );

        return;
      }


      button.disabled = true;

      button.textContent =
        "⏳ Creating...";


      const result =
        $("videoResult");

      if (result) {

        result.classList.add("hidden");

        result.innerHTML = "";

      }


      try {

        /* ==========================
           IMAGE
        ========================== */

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


        /* ==========================
           CREATE FIRESTORE JOB
        ========================== */

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
          "AI JOB CREATED:",
          docRef.id
        );


        showStatus(
          "queued",
          5,
          "⏳ AI job create हो गया। Processing शुरू होने का इंतजार है..."
        );


        /* ==========================
           REAL-TIME LISTENER
        ========================== */

        if (stopListener) {

          stopListener();

          stopListener = null;

        }


        stopListener =
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
                "VIDEO LIVE:",
                data.status,
                data.progress,
                data.progressMessage
              );


              /* LIVE STATUS */

              showStatus(
                data.status,
                data.progress,
                data.progressMessage
              );


              /* ====================
                 READY
              ==================== */

              if (
                data.status === "ready"
              ) {

                showStatus(
                  "ready",
                  100,
                  "🎉 Video पूरी तरह तैयार है!"
                );


                showReady(
                  data
                );


                button.disabled =
                  false;

                button.textContent =
                  "✨ Generate AI Video";


                if (stopListener) {

                  stopListener();

                  stopListener = null;

                }

                return;
              }


              /* ====================
                 ERROR
              ==================== */

              if (
                data.status === "error"
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


                button.disabled =
                  false;

                button.textContent =
                  "✨ Generate AI Video";


                if (stopListener) {

                  stopListener();

                  stopListener = null;

                }

              }

            },

            function (error) {

              console.error(
                "LIVE STATUS ERROR:",
                error
              );


              showStatus(
                "error",
                0,
                "❌ Live status error: " +
                error.message
              );


              button.disabled =
                false;

              button.textContent =
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
            error.message ||
            "AI job create failed."
          )
        );


        button.disabled =
          false;

        button.textContent =
          "✨ Generate AI Video";

      }

    };

}
```
