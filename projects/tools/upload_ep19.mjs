import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = path.resolve();
const VIDEO_PATH = path.join(ROOT, 'exports/EP19-Mechanistic-Interpretability-AGI-Final-1080p.mp4');
const THUMB_PATH = path.join(ROOT, 'exports/EP19-thumbnail.png');
const TOKEN_PATH = path.join(ROOT, '.youtube-tokens.json');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');

console.log('=== YOUTUBE UPLOADER: EPISODE 13 (EP19 - THE GRAND FINALE) ===');

if (!fs.existsSync(VIDEO_PATH)) {
  console.error(`❌ Video file not found: ${VIDEO_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(TOKEN_PATH)) {
  console.error(`❌ YouTube token file not found. Run npm run auth:youtube first.`);
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8')).installed || JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8')).web;

const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

const metadata = {
  snippet: {
    title: 'How We Unlocked the AI Black Box: Sparse Autoencoders, Golden Gate Claude & Superintelligence',
    description: `For decades, deep neural networks were treated as unfathomable black boxes. But in 2024, everything changed. Inside the historic breakthrough of Mechanistic Interpretability: how Anthropic used Sparse Autoencoders to extract millions of monosemantic thoughts, the hilarious and profound Golden Gate Claude experiment, Transformer Induction Heads, and how we will supervise superhuman AGI.

🚀 PART 13 OF 13: THE GRAND FINALE OF THE PROGRAMS MAGIC AI MASTERCLASS (From First Principles to AI Expert)

TIMESTAMPS:
00:00 - The Black Box Dilemma & Polysemantic Neurons
01:07 - Sparse Autoencoders: The Prisms of the Mind
02:06 - The Golden Gate Claude Experiment & Causal Steering
03:10 - Transformer Circuits & Induction Heads (The In-Context Spark)
04:09 - Superalignment & Scalable Oversight for Superhuman AI
05:08 - The Grand Synthesis: From Sand to Superintelligence (All 13 Episodes)

KEY PAPERS & CONCEPTS COVERED:
• Sparse Autoencoders (SAEs): Towards Monosemanticity: Decomposing Language Models With Dictionary Learning (Bricken et al., Anthropic 2023)
• Claude 3 Sonnet Monosemanticity: Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet (Templeton et al., Anthropic 2024)
• Golden Gate Claude: Causal feature manipulation & steering vectors in residual streams
• Transformer Circuits: A Mathematical Framework for Transformer Circuits (Elhage, Olah et al., Anthropic 2021)
• Induction Heads: In-context Learning and Induction Heads (Olsson et al., Anthropic 2022)
• Representation Engineering: A Top-Down Approach to AI Transparency (Zou et al., Center for AI Safety, 2023)
• Superalignment & Scalable Oversight: Weak-to-Strong Generalization: Eliciting Strong Capabilities With Weak Supervision (Burns et al., OpenAI 2023)

CONGRATULATIONS! You have completed the entire 13-Episode AI Masterclass on Programs Magic. From melting sand on a beach to controlling superintelligence, you now understand the core mathematical and systems reality of modern AI.

SUBSCRIBE to Programs Magic for upcoming advanced masterclasses, open-source AI builds, and deep-tech engineering breakdowns.

#AI #MechanisticInterpretability #Superintelligence #SparseAutoencoders #Anthropic #Claude #MachineLearning #DeepLearning #AGI #ProgramsMagic`,
    tags: [
      'mechanistic interpretability',
      'sparse autoencoders',
      'golden gate claude',
      'anthropic',
      'chris olah',
      'transformer circuits',
      'induction heads',
      'superalignment',
      'openai',
      'superintelligence',
      'agi',
      'neural network interpretability',
      'superposition',
      'feature steering',
      'artificial intelligence',
      'programs magic'
    ],
    categoryId: '27' // Education
  },
  status: {
    privacyStatus: 'private',
    publishAt: '2027-02-02T19:00:00Z',
    selfDeclaredMadeForKids: false
  }
};

async function upload() {
  const fileSize = fs.statSync(VIDEO_PATH).size;
  console.log(`Uploading ${VIDEO_PATH} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: metadata,
    media: {
      body: fs.createReadStream(VIDEO_PATH)
    }
  });

  const videoId = res.data.id;
  console.log(`✅ Upload successful! Video ID: ${videoId}`);
  console.log(`Watch URL: https://youtu.be/${videoId}`);
  console.log(`Scheduled Premiere: ${metadata.status.publishAt}`);

  if (fs.existsSync(THUMB_PATH)) {
    console.log(`Uploading thumbnail ${THUMB_PATH}...`);
    await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: fs.createReadStream(THUMB_PATH)
      }
    });
    console.log(`✅ Thumbnail set successfully!`);
  }
}

upload().catch(err => {
  console.error('❌ Upload failed:', err.message);
  process.exit(1);
});
