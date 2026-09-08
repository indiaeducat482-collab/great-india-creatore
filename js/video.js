import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let user = null;

onAuthStateChanged(auth, (u) => {
  user = u;

  if (!u) {
    location.href = "login.html";
  }
});

function compressImage(file, maxSide = 1000, quality = 0.68) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxSide / Math.max(img.width, img.height)
        );

        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", {
          alpha: false
        });

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(
          "image/jpeg",
          quality
        );

        URL.revokeObjectURL(objectUrl);

        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error("Screenshot read नहीं हो पाया.")
      );
    };

    img.src = objectUrl;
  });
}

$("createVideoBtn").onclick = async () => {
  if (!user) return;

  const siteUrl = $("siteUrl").value.trim();
  const file = $("imageFile").files[0];

  if (!siteUrl && !file) {
    $("videoStatus").textContent =
      "Website URL या screenshot दें.";
    return;
  }

  const button = $("createVideoBtn");

  button.disabled = true;

  $("videoStatus").textContent =
    "AI job create हो रहा है…";

  try {
    let imageDataUrl = "";

    /*
      IMPORTANT:
      अब screenshot Firebase Storage में upload नहीं होगा.
      इससे Firebase Storage CORS error नहीं आएगा.
    */

    if (file) {
      $("videoStatus").textContent =
        "Screenshot तैयार किया जा रहा है…";

      imageDataUrl = await compressImage(
        file,
        1000,
        0.68
      );

      /*
        Firestore document की 1 MiB limit से बचने के लिए
        जरूरत पड़ने पर image को और छोटा करेंगे.
      */

      if (imageDataUrl.length > 850000) {
        imageDataUrl = await compressImage(
          file,
          800,
          0.55
        );
      }

      if (imageDataUrl.length > 950000) {
        throw new Error(
          "Screenshot बहुत बड़ा है। कृपया छोटा screenshot चुनें."
        );
      }
    }

    /*
      अब सीधे Firestore में video job बनेगा.
    */

    const docRef = await addDoc(
      collection(db, "videos"),
      {
        userId: user.uid,

        category: $("category").value,

        siteUrl: siteUrl,

        imageDataUrl: imageDataUrl,

        language: $("language").value,

        voice: $("voice").value,

        instruction:
          $("instruction").value.trim(),

        status: "queued",

        title: "AI Website Video",

        createdAt: serverTimestamp()
      }
    );

    $("videoStatus").textContent =
      "✅ AI job create हो गया। Processing शुरू हो रही है…";

    /*
      Job का live status देखें.
    */

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();

        if (!data) return;

        if (data.status === "processing") {
          $("videoStatus").textContent =
            "⚙️ AI video processing हो रहा है…";
        }

        if (data.status === "ready") {
          unsubscribe();

          $("videoStatus").textContent =
            "✅ Video तैयार है!";

          $("videoResult").classList.remove(
            "hidden"
          );

          $("videoResult").innerHTML = `
            <h2>🎬 Your AI Video</h2>

            <p>
              ${data.title || "AI Website Video"}
            </p>

            <video
              controls
              style="width:100%;border-radius:12px"
              src="${data.outputUrl}"
            ></video>

            <p>
              <a
                class="primary"
                target="_blank"
                href="${data.outputUrl}"
              >
                Download Video
              </a>
            </p>
          `;

          button.disabled = false;
        }

        if (data.status === "error") {
          unsubscribe();

          $("videoStatus").textContent =
            "❌ " +
            (data.error ||
              "Video processing failed");

          button.disabled = false;
        }
      }
    );

  } catch (error) {

    console.error(error);

    $("videoStatus").textContent =
      "❌ " + error.message;

    button.disabled = false;
  }
};
