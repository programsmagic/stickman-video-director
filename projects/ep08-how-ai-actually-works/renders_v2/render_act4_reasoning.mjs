import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas'));
import { drawFigure, COLORS, INK, solve2BoneIK, spring } from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280, HEIGHT = 720, FPS = 30;
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act4.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act4-Reasoning-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act4_sfx.wav';
const MIX_FILE = '/tmp/ep02_act4_mix.wav';

console.log(`=== EP02 ACT 4: TEACHING AI TO REASON === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 57193;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Game-show fanfare (1.5s)
  add(1.5, 1.2, t => (Math.sin(2*Math.PI*523.25*t) + Math.sin(2*Math.PI*659.25*t)*0.7)*Math.exp(-t*3), 0.5);
  // Buzzer slam (14.0s)
  add(14.0, 0.3, t => (Math.sin(2*Math.PI*200*t) + noise()*0.7)*Math.exp(-t*8), 0.65);
  // Wrong red buzzer HONK (15.0s)
  add(15.0, 0.8, t => (Math.sin(2*Math.PI*110*t) + Math.sin(2*Math.PI*116*t))*Math.exp(-t*2), 0.7);

  // Detective spotlight clank (36.0s)
  add(36.0, 0.5, t => (Math.sin(2*Math.PI*300*t) + noise()*0.4)*Math.exp(-t*6), 0.45);
  // Pocket watch ticking (38s - 50s)
  for(let t=38.0; t<=50.0; t+=1.0){
    add(t, 0.05, time => Math.sin(2*Math.PI*2400*time)*Math.exp(-time*80), 0.25);
  }
  // Chalkboard thinking tokens stream (50s - 68s)
  for(let t=50.0; t<=68.0; t+=0.2){
    add(t, 0.03, time => noise()*Math.exp(-time*90), 0.15);
  }
  // Pocket watch snap & victory chime (70.0s)
  add(70.0, 0.3, t => Math.sin(2*Math.PI*1800*t)*Math.exp(-t*15), 0.45);
  add(70.3, 1.5, t => Math.sin(2*Math.PI*1046.50*t)*Math.exp(-t*3), 0.55);

  // Error alert buzz (76.0s)
  add(76.0, 0.5, t => Math.sin(2*Math.PI*150*t)*Math.exp(-t*5), 0.5);
  // Chalkboard eraser scrub (79s - 83s)
  for(let t=79.0; t<=83.0; t+=0.3){
    add(t, 0.18, time => noise()*Math.exp(-time*15), 0.35);
  }
  // GRPO Cash reward chime (98s, 102s, 106s)
  [98.0, 102.0, 106.0].forEach(st => {
    add(st, 1.2, t => (Math.sin(2*Math.PI*1320*t) + Math.sin(2*Math.PI*1760*t)*0.7)*Math.exp(-t*3), 0.55);
  });

  const bytes = Buffer.alloc(44+n*2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(rate,24); bytes.writeUInt32LE(rate*2,28); bytes.writeUInt16LE(2,32);
  bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++) bytes.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(s[i]*32767))),44+i*2);
  fs.writeFileSync(SFX_FILE, bytes);
}

execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.72[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${MIX_FILE}"`);
console.log('✓ Audio tracks compiled and mixed.');

// ---- VIDEO RENDERING PIPELINE ----
const ffmpeg = spawn('ffmpeg',[
  '-v','error','-y',
  '-f','rawvideo','-pix_fmt','rgba',
  '-s',`${WIDTH}x${HEIGHT}`,
  '-r',`${FPS}`,
  '-i','pipe:0',
  '-i',MIX_FILE,
  '-c:v','libx264','-preset','fast','-crf','18',
  '-pix_fmt','yuv420p',
  '-c:a','aac','-b:a','192k',
  '-shortest',
  OUTPUT
],{stdio:['pipe','inherit','inherit']});

const canvas = createCanvas(WIDTH, HEIGHT), ctx = canvas.getContext('2d');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

function glow(text,x,y,size,color,gc,align='center',font='NotoSans'){
  ctx.save();ctx.font=`bold ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';
  if(gc&&gc!=='none'){ctx.shadowColor=gc;ctx.shadowBlur=14;}
  ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
}

console.log('2. Starting frame rendering pipeline for Act 4...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep slate purple-tinted background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#0D0B18');bg.addColorStop(1,'#18122B');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Floor
    ctx.save();ctx.strokeStyle='rgba(167,139,250,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=500;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // Top HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    let banner = 'ACT 4: TEACHING AI TO REASON (CHAIN-OF-THOUGHT & DEEPSEEK-R1)';
    if(t>=35.0 && t<72.0) banner='THE CHESS DETECTIVE: HIDDEN <think> REASONING TOKENS';
    else if(t>=72.0) banner='AUTONOMOUS BACKTRACKING & REINFORCEMENT LEARNING (GRPO)';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: THE FAST AUCTIONEER GAME-SHOW FAIL (0.0s - 35.0s)
    // ---------------------------------------------------------
    if(t < 35.0){
      // Riddle Card
      ctx.save();
      ctx.fillStyle='rgba(30,41,59,0.85)';
      ctx.beginPath();ctx.roundRect(140, 120, WIDTH - 280, 80, 12);ctx.fill();
      glow('LOGIC RIDDLE: A bat and a ball cost $1.10 in total.', WIDTH/2, 145, 17, '#FFFFFF', 'none', 'center', 'NotoSans');
      glow('The bat costs $1.00 more than the ball. How much is the ball?', WIDTH/2, 175, 17, '#FEF08A', 'none', 'center', 'NotoSans');
      ctx.restore();

      // Fast Auctioneer at buzzer podium
      const buzzerHit = (t >= 14.0);
      drawFigure(ctx,{
        torso: 5, head: 5, facing: 'right',
        armL: [-15, 20], armR: buzzerHit ? [30, -5] : [20, 15], legL: [-10,0], legR:[10,0],
        eyes: 'wide', mouth: 'open', scarf: false
      },{x: 320, y: 520, r: 65});

      // Podium with big red buzzer
      ctx.fillStyle='#334155';
      ctx.fillRect(380, 380, 70, 140);
      ctx.fillStyle='#EF4444';
      ctx.shadowColor='#EF4444';ctx.shadowBlur=16;
      ctx.beginPath();ctx.arc(415, 375, 18, Math.PI, 0);ctx.fill();

      // Giant Red X Fail Screen
      if(t >= 15.0){
        ctx.save();
        ctx.fillStyle='rgba(239,68,68,0.92)';
        ctx.strokeStyle='#F87171';ctx.lineWidth=4;
        ctx.shadowColor='#EF4444';ctx.shadowBlur=25;
        ctx.beginPath();ctx.roundRect(WIDTH/2 + 50, 240, 380, 180, 16);ctx.fill();ctx.stroke();

        glow('AUCTIONEER BLURTS: "10 CENTS!"', WIDTH/2 + 240, 280, 18, '#FFFFFF', '#EF4444', 'center', 'NotoSans');
        glow('❌ WRONG! (Bat $1.10 + Ball $0.10 = $1.20)', WIDTH/2 + 240, 320, 15, '#FEE2E2', 'none', 'center', 'NotoSans');
        glow('REAL ANSWER: Ball = $0.05, Bat = $1.05', WIDTH/2 + 240, 360, 16, '#FEF08A', 'none', 'center', 'NotoSans');
        ctx.restore();
      }

      glow('Standard LLMs answer in 20ms with no scratchpad — speed without reflection!', WIDTH/2, 630, 19, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 2: THE CHESS DETECTIVE & <think> SCRATCHPAD (35.0s - 72.0s)
    // ---------------------------------------------------------
    else if(t>=35.0 && t<72.0){
      const sc = t - 35.0;

      // The Chess Detective (Mascot)
      drawFigure(ctx,{
        torso: 0, head: -5, facing: 'right',
        armL: [-15, 25], armR: [25, -25], legL: [-10,0], legR:[10,0],
        eyes: 'normal', mouth: 'neutral', scarf: true
      },{x: 240, y: 520, r: 65});

      // Deerstalker hat on Detective
      ctx.fillStyle='#78350F';
      ctx.beginPath();ctx.ellipse(240, 420, 28, 10, 0, 0, Math.PI*2);ctx.fill();

      // <think> Blueprint Chalkboard
      ctx.save();
      ctx.translate(WIDTH/2 + 120, 310);
      ctx.fillStyle='rgba(15,23,42,0.95)';
      ctx.strokeStyle='#A78BFA';ctx.lineWidth=3;
      ctx.shadowColor='#A78BFA';ctx.shadowBlur=20;
      ctx.beginPath();ctx.roundRect(-260, -160, 520, 320, 16);ctx.fill();ctx.stroke();

      glow('<think> HIDDEN REASONING TOKENS (OpenAI o1 / DeepSeek-R1)', 0, -125, 14, '#A78BFA', '#A78BFA', 'center', 'monospace');

      const steps = [
        'Step 1: Let x = cost of the ball.',
        'Step 2: Bat cost = x + $1.00.',
        'Step 3: Total equation: x + (x + 1.00) = 1.10',
        'Step 4: 2x = 0.10  =>  x = $0.05.',
        'Step 5: Verify: $0.05 + $1.05 = $1.10. Verified!'
      ];

      steps.forEach((st, idx)=>{
        glow(st, -220, -75 + idx*38, 14, '#F8FAFC', 'none', 'left', 'NotoSans');
      });

      glow('Final Spoken Token: "The ball costs exactly 5 cents."', 0, 125, 15, '#4ADE80', '#4ADE80', 'center', 'NotoSans');
      ctx.restore();

      glow('Reasoning models trade instant speed for deliberate System 2 planning.', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 3: BACKTRACKING & GRPO (72.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 72.0;

      // Chalkboard with Backtracking Erasure
      ctx.save();
      ctx.translate(380, 310);
      ctx.fillStyle='rgba(15,23,42,0.95)';
      ctx.strokeStyle='#F5A623';ctx.lineWidth=3;
      ctx.shadowColor='#F5A623';ctx.shadowBlur=16;
      ctx.beginPath();ctx.roundRect(-220, -150, 440, 300, 16);ctx.fill();ctx.stroke();

      glow('SELF-CORRECTION IN REAL-TIME', 0, -115, 16, '#F5A623', '#F5A623', 'center', 'NotoSans');
      glow('def binary_search(arr, target):', -180, -75, 13, '#94A3B8', 'none', 'left', 'monospace');
      glow('  # Wait... logic fails at edge case!', -180, -40, 13, '#EF4444', 'none', 'left', 'monospace');
      glow('  # Backtracking and rewriting branch...', -180, -5, 13, '#F5A623', 'none', 'left', 'monospace');
      glow('  mid = (low + high) // 2', -180, 30, 13, '#4ADE80', 'none', 'left', 'monospace');
      glow('  return mid  # Correct!', -180, 65, 13, '#4ADE80', 'none', 'left', 'monospace');
      ctx.restore();

      // GRPO Reinforcement Learning Scale (Right side)
      ctx.save();
      ctx.translate(WIDTH - 320, 310);
      ctx.fillStyle='rgba(30,41,59,0.95)';
      ctx.strokeStyle='#4ADE80';ctx.lineWidth=3;
      ctx.shadowColor='#4ADE80';ctx.shadowBlur=16;
      ctx.beginPath();ctx.roundRect(-140, -150, 280, 300, 16);ctx.fill();ctx.stroke();

      glow('GRPO TRAINING', 0, -115, 16, '#4ADE80', '#4ADE80', 'center', 'NotoSans');
      glow('(DeepSeek-R1 Formula)', 0, -88, 12, '#94A3B8', 'none', 'center', 'NotoSans');

      glow('A_i = (r_i - μ) / σ', 0, -40, 17, '#FEF08A', '#FEF08A', 'center', 'NotoSans');

      glow('• Group Rollout of Solutions', 0, 5, 13, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('• Automated Compiler Tests', 0, 35, 13, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('• Self-Discovered Backtracking!', 0, 75, 14, '#4ADE80', '#4ADE80', 'center', 'NotoSans');
      ctx.restore();

      glow('Nobody taught the AI how to backtrack — it discovered self-critique on its own!', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 4 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 4 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});

