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


const get = (id) => document.getElementById(id);

let user = null;
let unsubscribe = null;


/* LOGIN */

onAuthStateChanged(auth, (currentUser) => {

  user = currentUser;

  if (!user) {
    window.location.href = "login.html";
  }

});


/* IMAGE COMPRESS */

function compressImage(file) {

  return new Promise((resolve, reject) => {

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

        const context = canvas.getContext("2d");

        context.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        let quality = 0.65;

        let data = canvas.toDataURL(
          "image/jpeg",
          quality
        );

        while (data.length > 850000 && quality > 0.3) {

          quality = quality - 0.05;

          data = canvas.toDataURL(
            "image/jpeg",
            quality
          );

        }

        if (data.length > 950000) {

          reject(
            new Error(
              "Screenshot बहुत बड़ा है। छोटा screenshot upload करें।"
            )
          );

          return;
        }

        resolve(data);

      };

      img.onerror = () => {

        reject(
          new Error(
            "Screenshot पढ़ा नहीं जा सका।"
          )
        );

      };

      img.src = reader.result;

    };

    reader.onerror = () => {

      reject(
        new Error(
          "Screenshot read failed."
        )
      );

    };

    reader.readAsDataURL(file);

  });

}


/* STATUS MESSAGE */

function statusMessage(status) {

  switch (status) {

    case "queued":
      return "⏳ AI video job queue में है...";

    case "processing":
      return "⚙️ Video processing शुरू हो रही है...";

    case "analyzing":
      return "🔎 Website और screenshot analyze किए जा रहे हैं...";

    case "ai_script":
      return "🧠 AI Hindi script बना रहा है...";

    case "script_ready":
      return "✅ Hindi AI script तैयार है।";

    case "voice":
      return "🎙️ Hindi AI voice बनाई जा रही है...";

    case "voice_ready":
      return "✅ Hindi AI voice तैयार है।";

    case "video":
      return "🎬 MP4 video बनाई जा रही है...";

    case "video_ready":
      return "✅ MP4 video तैयार है।";

    case "uploading":
      return "☁️ Video Firebase Storage पर upload हो रही है...";

    case "finalizing":
      return "🔗 Download link तैयार किया जा रहा है...";

    case "ready":
      return "🎉 Video पूरी तरह तैयार है!";

    case "error":
      return "❌ Video processing में error आया।";

    default:
      return "⚙️ Video processing हो रही है...";

  }

}


/* SHOW STATUS */

function showStatus(status, progress, message) {

  const box = get("videoStatus");

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
    statusMessage(status);


  box.innerHTML =
    '<div style="margin-top:18px;padding:16px;border:1px solid #ddd;border-radius:12px;background:#f8f9fa;">' +

      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +

        '<span style="font-weight:600;">' +
          text +
        '</span>' +

        '<span style="font-weight:700;">' +
          percent +
          '%' +
        '</span>' +

      '</div>' +

      '<div style="width:100%;height:12px;background:#ddd;border-radius:20px;overflow:hidden;">' +

        '<div style="width:' +
          percent +
          '%;height:100%;background:#6366f1;border-radius:20px;transition:width .5s ease;"></div>' +

      '</div>' +

      '<div style="margin-top:8px;font-size:13px;color:#666;">' +
        'Status: ' +
        (status || "processing") +
      '</div>' +

    '</div>';

}


/* SHOW READY VIDEO */

function showReadyVideo(data) {

  const result = get("videoResult");

  if (!result) {
    return;
  }

  result.classList.remove("hidden");

  const url = data.outputUrl;

  if (!url) {

    result.innerHTML =
      '<div style="padding:16px;border:1px solid #f0c36d;border-radius:12px;background:#fff8e1;">' +
        '<h2>⚠️ Video तैयार है</h2>' +
        '<p>Download link नहीं मिला।</p>' +
      '</div>';

    return;
  }


  let scriptHtml = "";

  if (data.script) {

    scriptHtml =
      '<details style="margin-top:18px;">' +

        '<summary style="cursor:pointer;font-weight:600;">' +
          '📝 Generated Hindi Script' +
        '</summary>' +

        '<div style="margin-top:10px;padding:14px;background:#f5f5f5;border-radius:10px;white-space:pre-wrap;">' +
          data.script +
        '</div>' +

      '</details>';

  }


  result.innerHTML =
    '<div style="padding:18px;border:1px solid #b7e4c7;border-radius:14px;background:#f0fff4;">' +

      '<h2>🎬 Your AI Video</h2>' +

      '<p>' +
        (data.title || "AI Website Video") +
      '</p>' +

      '<video controls playsinline style="width:100%;max-width:900px;border-radius:12px;background:#000;">' +

        '<source src="' +
          url +
          '" type="video/mp4">' +

      '</video>' +

      '<div style="margin-top:15px;">' +

        '<a href="' +
          url +
          '" target="_blank" rel="noopener" class="primary">' +
          '⬇️ Download Video' +
        '</a>' +

      '</div>' +

      scriptHtml +

    '</div>';

}


/* SHOW ERROR */

function showVideoError(data) {

  const result = get("videoResult");

  if (!result) {
    return;
  }

  result.classList.remove("hidden");

  result.innerHTML =
    '<div style="padding:16px;border:1px solid #f5b5b5;border-radius:12px;background:#fff1f1;">' +

      '<h2>❌ Video नहीं बन सकी</h2>' +

      '<p>' +
        (data.error || "Video processing failed.") +
      '</p>' +

    '</div>';

}


/* CREATE BUTTON */

const button = get("createVideoBtn");


if (button) {

  button.addEventListener("click", async () => {

    if (!user) {

      alert("पहले Login करें।");

      return;
    }


    const siteUrl =
      get("siteUrl")
        ? get("siteUrl").value.trim()
        : "";


    const imageFile =
      get("imageFile") &&
      get("imageFile").files
        ? get("imageFile").files[0]
        : null;


    const category =
      get("category")
        ? get("category").value
        : "short";


    const language =
      get("language")
        ? get("language").value
        : "hi-IN";


    const voice =
      get("voice")
        ? get("voice").value
        : "hi-IN-Neural2-A";


    const instruction =
      get("instruction")
        ? get("instruction").value.trim()
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


    const result = get("videoResult");

    if (result) {

      result.classList.add("hidden");

      result.innerHTML = "";

    }


    try {

      /* SCREENSHOT */

      let imageDataUrl = "";

      if (imageFile) {

        showStatus(
          "processing",
          8,
          "📷 Screenshot तैयार किया जा रहा है..."
        );

        imageDataUrl =
          await compressImage(imageFile);

      }


      /* CREATE JOB */

      showStatus(
        "queued",
        5,
        "⏳ AI video job queue में भेजा जा रहा है..."
      );


      const videoRef =
        await addDoc(
          collection(db, "videos"),
          {

            userId:
              user.uid,

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
        "AI VIDEO JOB:",
        videoRef.id
      );


      /* REMOVE OLD LISTENER */

      if (unsubscribe) {

        unsubscribe();

        unsubscribe = null;

      }


      /* REAL TIME FIRESTORE */

      unsubscribe =
        onSnapshot(
          videoRef,

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


            /* LIVE PROGRESS */

            showStatus(
              data.status,
              data.progress,
              data.progressMessage
            );


            /* READY */

            if (data.status === "ready") {

              showStatus(
                "ready",
                100,
                data.progressMessage ||
                "🎉 Video पूरी तरह तैयार है!"
              );


              showReadyVideo(data);


              button.disabled = false;

              button.textContent =
                "✨ Generate AI Video";


              if (unsubscribe) {

                unsubscribe();

                unsubscribe = null;

              }

              return;
            }


            /* ERROR */

            if (data.status === "error") {

              showStatus(
                "error",
                0,
                data.progressMessage ||
                "❌ Video processing failed."
              );


              showVideoError(data);


              button.disabled = false;

              button.textContent =
                "✨ Generate AI Video";


              if (unsubscribe) {

                unsubscribe();

                unsubscribe = null;

              }

            }

          },

          (error) => {

            console.error(
              "FIRESTORE STATUS ERROR:",
              error
            );


            showStatus(
              "error",
              0,
              "❌ Live status error: " +
              error.message
            );


            button.disabled = false;

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


      button.disabled = false;

      button.textContent =
        "✨ Generate AI Video";

    }

  });

}
```
