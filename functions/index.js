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


/* =========================================
   FIRESTORE STATUS UPDATE
========================================= */

async function updateProgress(ref, status, progress, message) {
  await ref.update({
    status,
    progress,
    progressMessage: message,
    updatedAt: new Date()
  });

  console.log(
    `[${progress}%] ${status}: ${message}`
  );
}


/* =========================================
   GEMINI
========================================= */

async function generateScript(prompt, imageDataUrl) {

  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const gen = new GoogleGenerativeAI(key);

  const model = gen.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  let result;

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

  if (!result) {
    result = await model.generateContent(prompt);
  }

  return result.response.text().trim();
}


/* =========================================
   WEBSITE TEXT
========================================= */

async function getWebsiteText(url) {

  if (!url) {
    return "";
  }

  try {

    const controller =
      new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 GreatIndiaCreator"
      }
    });

    clearTimeout(timer);

    if (!response.ok) {
      return "";
    }

    let html =
      await response.text();

    html =
      html
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<noscript[\s\S]*?<\/noscript>/gi,
          " "
        )
        .replace(
          /<svg[\s\S]*?<\/svg>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
        .replace(
          /&nbsp;/gi,
          " "
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    return html.slice(0, 20000);

  } catch (error) {

    console.log(
      "Website fetch error:",
      error.message
    );

    return "";
  }
}


/* =========================================
   HINDI VOICE
========================================= */

async function createVoice(text, voiceName) {

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


/* =========================================
   VIDEO UPLOAD
========================================= */

async function uploadVideo(
  filePath,
  destination
) {

  const token =
    crypto.randomUUID();

  await bucket.upload(
    filePath,
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

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    bucket.name +
    "/o/" +
    encodeURIComponent(destination) +
    "?alt=media&token=" +
    token
  );
}


/* =========================================
   VIDEO CREATOR
========================================= */

exports.videoJobCreated =
  onDocumentCreated(
    {
      document:
        "videos/{videoId}",

      region:
        "asia-south1",

      timeoutSeconds:
        300,

      memory:
        "1GiB",

      maxInstances:
        5
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

      const videoId =
        event.params.videoId;

      const tempDir =
        fs.mkdtempSync(
          path.join(
            os.tmpdir(),
            "gic-video-"
          )
        );

      try {

        /* ===============================
           QUEUED
        =============================== */

        await updateProgress(
          snap.ref,
          "queued",
          5,
          "AI video job queue में है..."
        );


        /* ===============================
           PROCESSING
        =============================== */

        await updateProgress(
          snap.ref,
          "processing",
          10,
          "Video processing शुरू हो रही है..."
        );


        /* ===============================
           WEBSITE ANALYSIS
        =============================== */

        await updateProgress(
          snap.ref,
          "analyzing",
          20,
          "Website और screenshot analyze किए जा रहे हैं..."
        );

        const websiteText =
          await getWebsiteText(
            d.siteUrl
          );


        /* ===============================
           AI SCRIPT
        =============================== */

        await updateProgress(
          snap.ref,
          "ai_script",
          35,
          "Gemini AI Hindi script बना रहा है..."
        );

        const isShort =
          d.category !== "long";

        const duration =
          isShort
            ? "45 से 60 सेकंड"
            : "2 से 4 मिनट";

        const prompt = `
आप Great India Creator के लिए Hindi explanatory video narration तैयार करें।

Video type:
${isShort ? "Short Video" : "Long / Full Video"}

Target duration:
${duration}

Website URL:
${d.siteUrl || "Not provided"}

Website text:
${websiteText || "Website text उपलब्ध नहीं है। Screenshot को ध्यान से देखें।"}

Extra instruction:
${d.instruction || "कोई extra instruction नहीं है।"}

Screenshot यदि दिया गया है तो उसे ध्यान से analyze करें।

Narration में:
- Website का उद्देश्य
- Login / registration यदि दिखाई दे
- Dashboard
- Main services
- Important buttons
- User workflow
- Step-by-step usage
- Important features
- Short conclusion

केवल supported features बताएं।
कोई imaginary feature न बनाएं।

केवल natural Hindi narration दें।
कोई heading, markdown या bullet points न दें।
`;

        const script =
          await generateScript(
            prompt,
            d.imageDataUrl
          );

        if (!script) {
          throw new Error(
            "AI script generate नहीं हुई।"
          );
        }


        await updateProgress(
          snap.ref,
          "script_ready",
          45,
          "✅ Hindi AI script तैयार है।"
        );


        /* ===============================
           HINDI VOICE
        =============================== */

        await updateProgress(
          snap.ref,
          "voice",
          55,
          "Hindi AI voice तैयार की जा रही है..."
        );

        const audioData =
          await createVoice(
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


        await updateProgress(
          snap.ref,
          "voice_ready",
          65,
          "✅ Hindi AI voice तैयार है।"
        );


        /* ===============================
           VIDEO GENERATION
        =============================== */

        await updateProgress(
          snap.ref,
          "video",
          70,
          "MP4 video बनाई जा रही है..."
        );

        const outputFile =
          path.join(
            tempDir,
            "video.mp4"
          );

        const ffmpeg =
          require("ffmpeg-static");


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
                timeout:
                  180000
              },

              (error, stdout, stderr) => {

                if (error) {

                  console.error(
                    "FFmpeg error:",
                    stderr
                  );

                  reject(error);

                } else {

                  resolve();

                }
              }
            );
          }
        );


        await updateProgress(
          snap.ref,
          "video_ready",
          85,
          "✅ MP4 video तैयार है।"
        );


        /* ===============================
           STORAGE UPLOAD
        =============================== */

        await updateProgress(
          snap.ref,
          "uploading",
          90,
          "Video Firebase Storage पर upload हो रही है..."
        );

        const destination =
          `generated/${d.userId}/videos/${videoId}.mp4`;

        const outputUrl =
          await uploadVideo(
            outputFile,
            destination
          );


        await updateProgress(
          snap.ref,
          "finalizing",
          97,
          "Download link तैयार किया जा रहा है..."
        );


        /* ===============================
           READY
        =============================== */

        await snap.ref.update({

          status:
            "ready",

          progress:
            100,

          progressMessage:
            "🎉 Video पूरी तरह तैयार है!",

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
          "VIDEO READY:",
          videoId
        );


        /* ===============================
           CLEANUP
        =============================== */

        try {

          fs.rmSync(
            tempDir,
            {
              recursive:
                true,

              force:
                true
            }
          );

        } catch (_) {}

      } catch (error) {

        console.error(
          "VIDEO ERROR:",
          error
        );


        await snap.ref.update({

          status:
            "error",

          progress:
            0,

          progressMessage:
            "❌ Video बनाने में error आया।",

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
              recursive:
                true,

              force:
                true
            }
          );

        } catch (_) {}
      }
    }
  );


/* =========================================
   PPT CREATOR
========================================= */

exports.pptJobCreated =
  onDocumentCreated(
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

          status:
            "processing",

          progress:
            10,

          progressMessage:
            "PPT processing शुरू हो रही है...",

          updatedAt:
            new Date()
        });


        const key =
          process.env.GEMINI_API_KEY;

        if (!key) {
          throw new Error(
            "GEMINI_API_KEY is not configured."
          );
        }

        const gen =
          new GoogleGenerativeAI(
            key
          );

        const model =
          gen.getGenerativeModel({
            model:
              "gemini-2.5-flash"
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
      "Point 2"
    ]
  }
]

Notes:

${d.sourceText || ""}
`;


        await snap.ref.update({

          status:
            "ai_processing",

          progress:
            35,

          progressMessage:
            "Gemini AI PPT slides बना रहा है...",

          updatedAt:
            new Date()
        });


        const result =
          await model.generateContent(
            prompt
          );

        let raw =
          result.response.text()
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
            "Valid PPT slides नहीं मिलीं।"
          );
        }


        await snap.ref.update({

          status:
            "creating_ppt",

          progress:
            60,

          progressMessage:
            "PowerPoint file बनाई जा रही है...",

          updatedAt:
            new Date()
        });


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
              color:
                "F7F8FC"
            };


            slide.addText(
              item.title ||
              `Topic ${index + 1}`,
              {
                x:
                  0.7,

                y:
                  0.5,

                w:
                  12,

                h:
                  0.7,

                fontSize:
                  28,

                bold:
                  true,

                color:
                  "5B45E6"
              }
            );


            const bullets =
              (item.bullets || [])
                .map(
                  (text) => ({
                    text:
                      String(text),

                    options: {
                      bullet: {
                        indent:
                          14
                      }
                    }
                  })
                );


            slide.addText(
              bullets,
              {
                x:
                  1,

                y:
                  1.5,

                w:
                  11,

                h:
                  5,

                fontSize:
                  20,

                color:
                  "172033",

                breakLine:
                  false,

                fit:
                  "shrink"
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
          fileName:
            output
        });


        await snap.ref.update({

          status:
            "uploading",

          progress:
            85,

          progressMessage:
            "PPT Firebase Storage पर upload हो रही है...",

          updatedAt:
            new Date()
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

          status:
            "ready",

          progress:
            100,

          progressMessage:
            "🎉 PPT पूरी तरह तैयार है!",

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
              recursive:
                true,

              force:
                true
            }
          );

        } catch (_) {}

      } catch (error) {

        console.error(
          "PPT ERROR:",
          error
        );


        await snap.ref.update({

          status:
            "error",

          progress:
            0,

          progressMessage:
            "❌ PPT बनाने में error आया।",

          error:
            error?.message ||
            "PPT processing failed",

          updatedAt:
            new Date()
        });
      }
    }
  );
