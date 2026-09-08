const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const textToSpeech = require("@google-cloud/text-to-speech");
const PptxGenJS = require("pptxgenjs");
const { execFile } = require("child_process");

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();

/* =========================
   GEMINI TEXT AI
========================= */

async function aiText(prompt) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured in Functions secrets."
    );
  }

  const gen = new GoogleGenerativeAI(key);

  const model = gen.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const result = await model.generateContent(prompt);

  return result.response.text();
}

/* =========================
   GEMINI MULTIMODAL AI
   Screenshot + Text
========================= */

async function aiTextWithImage(prompt, imageDataUrl) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured in Functions secrets."
    );
  }

  if (!imageDataUrl || !imageDataUrl.includes(",")) {
    return aiText(prompt);
  }

  const gen = new GoogleGenerativeAI(key);

  const model = gen.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const parts = [];

  parts.push({
    text: prompt
  });

  try {
    const match = imageDataUrl.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return aiText(prompt);
    }

    const mimeType = match[1];
    const base64Data = match[2];

    parts.push({
      inlineData: {
        mimeType,
        data: base64Data
      }
    });

    const result = await model.generateContent(parts);

    return result.response.text();

  } catch (error) {
    console.error("Gemini image analysis error:", error);

    // अगर screenshot पढ़ने में error हो तो
    // केवल text prompt से AI चलाएँ
    return aiText(prompt);
  }
}

/* =========================
   VIDEO JOB
========================= */

exports.videoJobCreated = onDocumentCreated(
  {
    document: "videos/{videoId}",
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB"
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

    try {

      /* =========================
         STATUS: PROCESSING
      ========================= */

      await snap.ref.update({
        status: "processing",
        updatedAt: new Date()
      });

      /* =========================
         WEBSITE TEXT
      ========================= */

      let page = "";

      if (d.siteUrl) {

        try {

          const response = await fetch(d.siteUrl, {
            redirect: "follow"
          });

          page = await response.text();

          page = page
            .replace(
              /<script[\s\S]*?<\/script>/gi,
              " "
            )
            .replace(
              /<style[\s\S]*?<\/style>/gi,
              " "
            )
            .replace(
              /<[^>]+>/g,
              " "
            )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(0, 30000);

        } catch (error) {

          console.error(
            "Website fetch failed:",
            error
          );

          page = "";
        }
      }

      /* =========================
         VIDEO LENGTH
      ========================= */

      const duration =
        d.category === "short"
          ? "45-60 second"
          : "2-4 minute";

      /* =========================
         AI PROMPT
      ========================= */

      const prompt = `
Create a natural Hindi explanatory video narration.

Video duration:
${duration}

Website / Portal purpose:
Explain what this website or portal does.

The narration must explain:
1. Website का नाम और उद्देश्य
2. Login / registration अगर दिखाई देता है
3. Dashboard
4. Main services
5. Important buttons
6. User workflow
7. How a normal user can use the portal
8. Important features visible on the website
9. Ending में short useful conclusion

IMPORTANT:
- केवल वही features बताएं जो website text या screenshot से supported हों।
- कोई imaginary feature invent न करें।
- भाषा आसान और natural Hindi हो।
- Video में बोलने के लिए narration तैयार करें।
- Heading, bullet points या markdown न दें।
- केवल पूरा natural Hindi narration दें।

Extra instruction:
${d.instruction || "None"}

Website text:
${page || "No website text available."}

यदि screenshot दिया गया है तो screenshot को ध्यान से देखकर
उसमें दिखाई देने वाले buttons, menus, forms, dashboard,
branding और services को भी समझें।
`;

      /* =========================
         AI SCRIPT GENERATION
      ========================= */

      let script = "";

      if (d.imageDataUrl) {

        script = await aiTextWithImage(
          prompt,
          d.imageDataUrl
        );

      } else {

        script = await aiText(prompt);

      }

      /* =========================
         HINDI TEXT TO SPEECH
      ========================= */

      const tts =
        new textToSpeech.TextToSpeechClient();

      const [speech] =
        await tts.synthesizeSpeech({

          input: {
            text: script
          },

          voice: {
            languageCode: "hi-IN",
            name: d.voice || "hi-IN-Neural2-A"
          },

          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0
          }

        });

      /* =========================
         TEMP FILES
      ========================= */

      const dir = fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "gic-video-"
        )
      );

      const audio =
        path.join(
          dir,
          "voice.mp3"
        );

      const output =
        path.join(
          dir,
          "video.mp4"
        );

      fs.writeFileSync(
        audio,
        speech.audioContent
      );

      /* =========================
         FFMPEG
      ========================= */

      const ffmpeg =
        require("ffmpeg-static");

      await new Promise(
        (resolve, reject) => {

          execFile(
            ffmpeg,

            [
              "-f",
              "lavfi",

              "-i",
              "color=c=0x17142d:s=1280x720:r=30",

              "-i",
              audio,

              "-vf",

              "drawtext=text='Great India Creator':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=280,drawtext=text='AI Website Explanatory Video':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=360",

              "-c:v",
              "libx264",

              "-c:a",
              "aac",

              "-shortest",

              "-pix_fmt",
              "yuv420p",

              output
            ],

            {
              timeout: 500000
            },

            (error) => {

              if (error) {
                reject(error);
              } else {
                resolve();
              }

            }
          );

        }
      );

      /* =========================
         UPLOAD GENERATED VIDEO
         SERVER SIDE
      ========================= */

      const destination =
        `generated/${d.userId}/videos/${event.params.videoId}.mp4`;

      const token =
        crypto.randomUUID();

      await bucket.upload(
        output,
        {
          destination,

          metadata: {
            contentType: "video/mp4",

            metadata: {
              firebaseStorageDownloadTokens:
                token
            }
          }
        }
      );

      /* =========================
         DOWNLOAD URL
      ========================= */

      const outputUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

      /* =========================
         READY
      ========================= */

      await snap.ref.update({

        status: "ready",

        script,

        outputUrl,

        title:
          d.category === "short"
            ? "AI Short Website Video"
            : "AI Full Website Video",

        updatedAt: new Date()

      });

      console.log(
        `Video ${event.params.videoId} completed successfully.`
      );

    } catch (error) {

      console.error(
        "Video processing error:",
        error
      );

      await snap.ref.update({

        status: "error",

        error:
          error?.message ||
          "Video processing failed",

        updatedAt: new Date()

      });

    }
  }
);


/* =========================
   PPT JOB
========================= */

exports.pptJobCreated = onDocumentCreated(
  {
    document: "presentations/{presentationId}",
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB"
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

    try {

      /* =========================
         PROCESSING
      ========================= */

      await snap.ref.update({

        status: "processing",

        updatedAt: new Date()

      });

      /* =========================
         PPT PROMPT
      ========================= */

      const prompt = `
Convert the following study notes into a clean PowerPoint presentation.

Title:
${d.title || "Study Presentation"}

Instruction:
${d.instruction || "Create a clear educational presentation."}

Rules:
- One topic per slide.
- Create a suitable title for every slide.
- Use short, clear bullet points.
- Do not invent information.
- Return ONLY valid JSON.
- JSON must be an array.
- Every item must have:
  {
    "title": "Slide title",
    "bullets": ["Point 1", "Point 2"]
  }

Notes:
${d.sourceText || ""}
`;

      /* =========================
         AI PPT OUTLINE
      ========================= */

      let raw =
        await aiText(prompt);

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
          "AI did not return valid PPT slides."
        );
      }

      /* =========================
         CREATE PPTX
      ========================= */

      const ppt =
        new PptxGenJS();

      ppt.layout =
        "LAYOUT_WIDE";

      ppt.author =
        "Great India Creator";

      ppt.subject =
        d.title ||
        "AI Generated Presentation";

      ppt.title =
        d.title ||
        "AI Presentation";

      slides.forEach(
        (slideData, index) => {

          const slide =
            ppt.addSlide();

          slide.background = {
            color: "F7F8FC"
          };

          slide.addText(
            slideData.title ||
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
            (slideData.bullets || [])
              .map(
                (text) => ({
                  text: String(text),

                  options: {
                    bullet: {
                      indent: 14
                    }
                  }
                })
              );

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

      /* =========================
         SAVE PPTX
      ========================= */

      const dir =
        fs.mkdtempSync(
          path.join(
            os.tmpdir(),
            "gic-ppt-"
          )
        );

      const output =
        path.join(
          dir,
          `${event.params.presentationId}.pptx`
        );

      await ppt.writeFile({
        fileName: output
      });

      /* =========================
         UPLOAD PPT
      ========================= */

      const destination =
        `generated/${d.userId}/ppt/${event.params.presentationId}.pptx`;

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

      /* =========================
         PPT DOWNLOAD URL
      ========================= */

      const outputUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

      /* =========================
         READY
      ========================= */

      await snap.ref.update({

        status: "ready",

        slideCount:
          slides.length,

        outputUrl,

        updatedAt:
          new Date()

      });

      console.log(
        `PPT ${event.params.presentationId} completed successfully.`
      );

    } catch (error) {

      console.error(
        "PPT processing error:",
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
