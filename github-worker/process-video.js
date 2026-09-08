const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpegPath = require('ffmpeg-static');

const execFileAsync = promisify(execFile);

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON GitHub Secret is missing.');
  try { return JSON.parse(raw); } catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
}

const serviceAccount = loadServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function update(ref, data) {
  await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
}

function safeFileName(value) {
  return String(value || 'AI Website Video').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

async function fetchWebsite(url) {
  if (!url) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 GreatIndiaCreator/1.0' }
    });
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30000);
  } finally { clearTimeout(timer); }
}

function imagePart(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/s);
  if (!m) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

async function makeScript(job) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY GitHub Secret is missing.');
  const gen = new GoogleGenerativeAI(key);
  const model = gen.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const seconds = job.category === 'long' ? '2 to 4 minutes' : '45 to 60 seconds';
  const minWords = job.category === 'long' ? 420 : 120;
  const maxWords = job.category === 'long' ? 650 : 190;
  const prompt = `Create a natural spoken Hindi narration for a ${seconds} explanatory video about this website/portal.\n\nRules:\n- Target ${minWords}-${maxWords} Hindi words.\n- Explain the purpose, visible services/features and user flow step by step.\n- Use simple spoken Hindi suitable for AI voice.\n- Do not invent features that are not supported by the supplied website text or screenshot.\n- If a screenshot is supplied, use it as visual evidence.\n- Do not mention that you are AI.\n- Extra instruction: ${job.instruction || 'None'}\n\nWebsite URL: ${job.siteUrl || 'Not provided'}\nWebsite text:\n${job.pageText || 'No website text was available.'}\n\nReturn ONLY narration text, no headings, markdown or bullets.`;
  const parts = [prompt];
  const img = imagePart(job.imageDataUrl);
  if (img) parts.push(img);
  const result = await model.generateContent(parts);
  return result.response.text().trim();
}

async function runEdgeTts(text, outFile, voice) {
  const selectedVoice = voice === 'hi-IN-MadhurNeural' ? voice : 'hi-IN-SwaraNeural';
  await execFileAsync('python', ['-m', 'edge_tts', '--voice', selectedVoice, '--text', text, '--write-media', outFile], { timeout: 180000 });
}

function dataUrlToFile(dataUrl, outFile) {
  const m = String(dataUrl || '').match(/^data:(image\/[^;]+);base64,(.+)$/s);
  if (!m) return false;
  fs.writeFileSync(outFile, Buffer.from(m[2], 'base64'));
  return true;
}

async function makeVideo(job, audioFile, outFile, screenshotFile) {
  const title = 'Great India Creator';
  const subtitle = job.category === 'long' ? 'AI Full Website Video' : 'AI Short Website Video';
  const url = (job.siteUrl || '').replace(/'/g, "''").slice(0, 90);
  let args;
  if (screenshotFile) {
    args = [
      '-y', '-loop', '1', '-i', screenshotFile, '-i', audioFile,
      '-vf', "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p,drawbox=x=0:y=0:w=iw:h=92:color=black@0.72:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Great India Creator':fontcolor=white:fontsize=40:x=38:y=25",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-tune', 'stillimage',
      '-c:a', 'aac', '-b:a', '128k', '-shortest', '-pix_fmt', 'yuv420p', outFile
    ];
  } else {
    args = [
      '-y', '-f', 'lavfi', '-i', 'color=c=0x17142d:s=1280x720:r=30', '-i', audioFile,
      '-vf', `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${title}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=235,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${subtitle}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=320,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${url}':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=410`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-pix_fmt', 'yuv420p', outFile
    ];
  }
  await execFileAsync(ffmpegPath, args, { timeout: 500000 });
}

async function uploadVideo(jobId, userId, file) {
  const dest = `generated/${userId}/videos/${jobId}.mp4`;
  const token = crypto.randomUUID();
  await bucket.upload(file, {
    destination: dest,
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token } }
  });
  const outputUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
  return { dest, outputUrl };
}

async function processJob(doc) {
  const ref = doc.ref;
  const job = doc.data();
  const jobId = doc.id;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `gic-${jobId}-`));
  const audio = path.join(work, 'voice.mp3');
  const video = path.join(work, `${safeFileName(job.title || 'AI-Website-Video')}.mp4`);
  const screenshot = path.join(work, 'screenshot.jpg');

  try {
    await update(ref, { status: 'processing', progress: 10, progressMessage: '🔎 Website analyze हो रही है...' });
    let pageText = '';
    try { pageText = await fetchWebsite(job.siteUrl); }
    catch (e) { if (!job.imageDataUrl) throw e; }

    await update(ref, { status: 'analyzing', progress: 20, progressMessage: '🧠 Website content समझा जा रहा है...', pageText: pageText.slice(0, 30000) });

    const script = await makeScript({ ...job, pageText });
    await update(ref, { status: 'script_ready', progress: 45, progressMessage: '📝 Hindi AI script तैयार है...', script });

    await update(ref, { status: 'voice', progress: 55, progressMessage: '🎙️ Hindi AI voice बन रही है...' });
    await runEdgeTts(script, audio, job.voice);
    await update(ref, { status: 'voice_ready', progress: 68, progressMessage: '🎙️ Hindi voice तैयार है...' });

    let screenshotFile = null;
    if (job.imageDataUrl && dataUrlToFile(job.imageDataUrl, screenshot)) screenshotFile = screenshot;

    await update(ref, { status: 'video', progress: 75, progressMessage: '🎬 MP4 video render हो रही है...' });
    await makeVideo(job, audio, video, screenshotFile);
    await update(ref, { status: 'video_ready', progress: 90, progressMessage: '🎬 MP4 तैयार है, upload हो रही है...' });

    await update(ref, { status: 'uploading', progress: 94, progressMessage: '☁️ Video Firebase Storage में upload हो रही है...' });
    const uploaded = await uploadVideo(jobId, job.userId, video);

    await update(ref, {
      status: 'ready', progress: 100, progressMessage: '🎉 Video पूरी तरह तैयार है!',
      outputUrl: uploaded.outputUrl, storagePath: uploaded.dest,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`READY ${jobId}`);
  } catch (error) {
    console.error(`FAILED ${jobId}`, error);
    await update(ref, { status: 'error', progress: 0, progressMessage: '❌ Video processing failed', error: error.message || String(error) });
    throw error;
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}

async function main() {
  const limit = Math.max(1, Math.min(3, Number(process.env.JOB_LIMIT || 1)));
  const snapshot = await db.collection('videos').where('status', '==', 'queued').orderBy('createdAt', 'asc').limit(limit).get();
  if (snapshot.empty) { console.log('No queued video jobs.'); return; }

  for (const doc of snapshot.docs) {
    const claimed = await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      const data = fresh.data();
      if (!data || data.status !== 'queued') return false;
      tx.update(doc.ref, {
        status: 'processing', progress: 8,
        progressMessage: '⚙️ GitHub Actions worker ने job ले लिया है...',
        worker: 'github-actions', workerStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    });
    if (!claimed) continue;
    await processJob(await doc.ref.get());
  }
}

main().catch(err => { console.error(err); process.exit(1); });
