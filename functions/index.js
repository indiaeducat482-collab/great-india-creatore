const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const textToSpeech = require("@google-cloud/text-to-speech");
const { execFile } = require("child_process");

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();

/* =========================
   GEMINI
========================= */

function getGemini() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenerativeAI(key);
}

async function generateVideoScript(prompt, imageDataUrl) {
  const gen = getGemini();

  const model = gen.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  let result;

  /* Screenshot available */
  if (
    imageDataUrl &&
    imageDataUrl.startsWith("data:image/")
  ) {
    const match = imageDataUrl.match(
      /^data:(image\/[^;]+);base64,(.+)$/
    );

    if (match) {
      result = await model.generateContent([
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        }
      ]);
    }
  }

  /* Text only */
  if (!result) {
    result = await model.generateContent(prompt);
  }

  return result.response.text().trim();
}

/* =========================
   SAFE WEBSITE TEXT
========================= */

async function getWebsiteText(url) {
  if (!url) return "";

  try {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 12000);

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 GreatIndiaCreatorBot/1.0"
      }
    });

    clearTimeout(timer);

    if (!response.ok) {
      return "";
    }

    let html = await response.text();

    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();

    return html.slice(0, 20000);

  } catch (error) {
    console.log(
      "Website text unavailable:",
      error.message
    );

    return "";
  }
}

/* =========================
   HINDI TTS
========================= */

async function createHindiVoice(text, voiceName) {
  const client =
    new textToSpeech.TextToSpeechClient();

  const [response] =
    await client.synthesizeSpeech({
      input: {
        text
      },

      voice: {
        languageCode: "hi-IN",
        name:
          voiceName ||
          "hi-IN-Neural2-A"
      },

      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.05
      }
    });

  return response.audioContent;
}

/* =========================
   UPLOAD FILE
========================= */

async function uploadVideo(filePath, destination) {
  const token = crypto.randomUUID();

  await bucket.upload(filePath, {
    destination,

    metadata: {
      contentType: "video/mp4",

      metadata: {
        firebaseStorageDownloadTokens:
          token
      }
    }
  });

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    bucket.name +
    "/o/" +
    encodeURIComponent(destination) +
    "?alt=media&token=" +
    token
  );
}

/* =========================
   VIDEO JOB
========================= */

exports.videoJobCreated = onDocumentCreated(
  {
    document: "videos/{videoId}",

    region: "asia-south1",

    timeoutSeconds: 300,

    memory: "1GiB",

    maxInstances: 5
  },

  async (event) => {

    const snap = event.data;

    if (!snap) {
      return;
    }

    const d = snap.data();

    if (!d) {
      return;
    }

    const videoId =
      event.params.videoId;

    const tempDir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "gic-"
        )
      );

    try {

      console.log(
        "VIDEO JOB START:",
        videoId
      );

      /* =========================
         PROCESSING
      ========================= */

      await snap.ref.update({
        status: "processing",
        updatedAt: new Date()
      });

      /* =========================
         WEBSITE TEXT
      ========================= */

      const websiteText =
        await getWebsiteText(
          d.siteUrl
        );

      /* =========================
         VIDEO LENGTH
      ========================= */

      const isShort =
        d.category !== "long";

      const durationText =
        isShort
          ? "45 से 60 सेकंड"
          : "2 से 4 मिनट";

      /* =========================
         AI PROMPT
      ========================= */

      const prompt = `
आप Great India Creator के लिए Hindi AI explanatory video बना रहे हैं।

Video type:
${isShort ? "Short Video" : "Long / Full Video"}

Target duration:
${durationText}

Website URL:
${d.siteUrl || "Not provided"}

Website text:
${websiteText || "Website text उपलब्ध नहीं है। Screenshot को देखें।"}

Extra instruction:
${d.instruction || "कोई अतिरिक्त instruction नहीं है।"}

काम:

Website/portal को ध्यान से समझकर एक natural Hindi narration लिखें।

Narration में:

1. Website/portal का उद्देश्य बताएं।
2. दिखाई देने वाले मुख्य sections बताएं।
3. Login/registration दिखाई दे तो समझाएं।
4. Dashboard और मुख्य services समझाएं।
5. महत्वपूर्ण buttons और उनका उपयोग बताएं।
6. User को step-by-step बताएं कि portal कैसे इस्तेमाल करना है।
7. Screenshot में दिखाई देने वाली चीजों को प्राथमिकता दें।
8. केवल supported features बताएं।
9. कोई feature invent न करें।

बहुत जरूरी:

- केवल narration दें।
- कोई heading नहीं।
- कोई bullet नहीं।
- कोई markdown नहीं।
- भाषा आसान Hindi हो।
- Voice-over के लिए natural sentences हों।
- शुरुआत आकर्षक हो।
- अंत में छोटा conclusion दें।
`;

      /* =========================
         GEMINI SCRIPT
      ========================= */

      console.log(
        "Generating Hindi AI script..."
      );

      const script =
        await generateVideoScript(
          prompt,
          d.imageDataUrl
        );

      if (!script) {
        throw new Error(
          "AI script generate नहीं हुआ।"
        );
      }

      console.log(
        "AI SCRIPT READY"
      );

      /* =========================
         HINDI VOICE
      ========================= */

      console.log(
        "Generating Hindi voice..."
      );

      const audioData =
        await createHindiVoice(
          script,
          d.voice
        );

      const audioFile =
        path.join(
          tempDir,
          "voice.mp3"
        );

      fs.writeFileSync(
        audioFile,
        audioData
      );

      console.log(
        "HINDI VOICE READY"
      );

      /* =========================
         VIDEO FILE
      ========================= */

      const outputFile =
        path.join(
          tempDir,
          "video.mp4"
        );

      const ffmpeg =
        require("ffmpeg-static");

      /* =========================
         FFMPEG
      ========================= */

      console.log(
        "Creating MP4..."
      );

      await new Promise(
        (resolve, reject) => {

          execFile(
            ffmpeg,

            [
              "-y",

              "-f",
              "lavfi",

              "-i",
              "color=c=0x17142d:s=1280x720:r=30",

              "-i",
              audioFile,

              "-vf",

              "drawtext=text='Great India Creator':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=280,drawtext=text='AI Website Explanatory Video':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=360",

              "-c:v",
              "libx264",

              "-preset",
              "ultrafast",

              "-tune",
              "stillimage",

              "-c:a",
              "aac",

              "-b:a",
              "128k",

              "-shortest",

              "-pix_fmt",
              "yuv420p",

              outputFile
            ],

            {
              timeout: 180000
            },

            (error, stdout, stderr) => {

              if (error) {

                console.error(
                  "FFMPEG ERROR:",
                  stderr
                );

                reject(error);

                return;
              }

              resolve();
            }
          );
        }
      );

      console.log(
        "MP4 READY"
      );

      /* =========================
         FIREBASE STORAGE
      ========================= */

      const destination =
        `generated/${d.userId}/videos/${videoId}.mp4`;

      console.log(
        "Uploading MP4..."
      );

      const outputUrl =
        await uploadVideo(
          outputFile,
          destination
        );

      console.log(
        "VIDEO UPLOAD READY"
      );

      /* =========================
         FINAL STATUS
      ========================= */

      await snap.ref.update({

        status: "ready",

        title:
          isShort
            ? "AI Short Website Video"
            : "AI Full Website Video",

        script,

        outputUrl,

        updatedAt:
          new Date()

      });

      console.log(
        "VIDEO JOB COMPLETED:",
        videoId
      );

      /* =========================
         CLEANUP
      ========================= */

      try {
        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );
      } catch (_) {}

    } catch (error) {

      console.error(
        "VIDEO JOB ERROR:",
        error
      );

      await snap.ref.update({

        status: "error",

        error:
          error?.message ||
          "Video processing failed",

        updatedAt:
          new Date()

      });

      try {
        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );
      } catch (_) {}
    }
  }
);


/* =========================
   PPT JOB
========================= */

exports.pptJobCreated = onDocumentCreated(
  {
    document:
      "presentations/{presentationId}",

    region:
      "asia-south1",

    timeoutSeconds:
      300,

    memory:
      "1GiB"
  },

  async (event) => {

    const snap =
      event.data;

    if (!snap) {
      return;
    }

    const d =
      snap.data();

    if (!d) {
      return;
    }

    const presentationId =
      event.params.presentationId;

    try {

      await snap.ref.update({
        status: "processing",
        updatedAt: new Date()
      });

      const prompt = `
Convert these study notes into a clean PowerPoint presentation.

Title:
${d.title || "Study Presentation"}

Instruction:
${d.instruction || "Create a clear educational presentation."}

Rules:

- One topic per slide.
- Clear slide title.
- Short bullet points.
- Do not invent information.
- Return ONLY valid JSON.
- Return an array.

Format:

[
  {
    "title": "Slide title",
    "bullets": [
      "Point 1",
      "Point 2",
      "Point 3"
    ]
  }
]

Notes:

${d.sourceText || ""}
`;

      let raw =
        await aiTextSimple(prompt);

      raw =
        raw
          .replace(
            /^```json/i,
            ""
          )
          .replace(
            /^```/i,
            ""
          )
          .replace(
            /```$/i,
            ""
          )
          .trim();

      const slides =
        JSON.parse(raw);

      if (
        !Array.isArray(slides) ||
        slides.length === 0
      ) {
        throw new Error(
          "Valid PPT slides नहीं मिले।"
        );
      }

      const ppt =
        new PptxGenJS();

      ppt.layout =
        "LAYOUT_WIDE";

      ppt.author =
        "Great India Creator";

      ppt.title =
        d.title ||
        "AI Presentation";

      slides.forEach(
        (item, index) => {

          const slide =
            ppt.addSlide();

          slide.background = {
            color: "F7F8FC"
          };

          slide.addText(
            item.title ||
            `Topic ${index + 1}`,
            {
              x: 0.7,
              y: 0.5,
              w: 12,
              h: 0.7,
              fontSize: 28,
              bold: true,
              color: "5B45E6"
            }
          );

          const bullets =
            (item.bullets || [])
              .map((text) => ({
                text: String(text),
                options: {
                  bullet: {
                    indent: 14
                  }
                }
              }));

          slide.addText(
            bullets,
            {
              x: 1,
              y: 1.5,
              w: 11,
              h: 5,
              fontSize: 20,
              color: "172033",
              breakLine: false,
              fit: "shrink"
            }
          );
        }
      );

      const tempDir =
        fs.mkdtempSync(
          path.join(
            os.tmpdir(),
            "gic-ppt-"
          )
        );

      const output =
        path.join(
          tempDir,
          `${presentationId}.pptx`
        );

      await ppt.writeFile({
        fileName: output
      });

      const destination =
        `generated/${d.userId}/ppt/${presentationId}.pptx`;

      const token =
        crypto.randomUUID();

      await bucket.upload(
        output,
        {
          destination,

          metadata: {
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",

            metadata: {
              firebaseStorageDownloadTokens:
                token
            }
          }
        }
      );

      const outputUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

      await snap.ref.update({

        status: "ready",

        slideCount:
          slides.length,

        outputUrl,

        updatedAt:
          new Date()

      });

      try {
        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );
      } catch (_) {}

    } catch (error) {

      console.error(
        "PPT JOB ERROR:",
        error
      );

      await snap.ref.update({

        status: "error",

        error:
          error?.message ||
          "PPT processing failed",

        updatedAt:
          new Date()

      });
    }
  }
);


/* =========================
   SIMPLE GEMINI FOR PPT
========================= */

async function aiTextSimple(prompt) {

  const key =
    process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const gen =
    new GoogleGenerativeAI(key);

  const model =
    gen.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

  const result =
    await model.generateContent(
      prompt
    );

  return result.response.text();
}
