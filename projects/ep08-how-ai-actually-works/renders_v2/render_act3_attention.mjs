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
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act3.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act3-Attention-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act3_sfx.wav';
const MIX_FILE = '/tmp/ep02_act3_mix.wav';

console.log(`=== EP02 ACT 3: THE MAGIC OF ATTENTION === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 48291;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Amnesia conveyor squeak (2s - 25s)
  add(2.0, 24.0, t => (Math.sin(2*Math.PI*60*t)*0.15 + noise()*0.05)*Math.sin(Math.PI*t/24.0), 0.25);
  // Paper airplane whoosh (28s)
  add(28.0, 1.2, t => noise()*Math.sin(t/1.2*Math.PI), 0.4);
  // Glass shatter transformer reveal (34s)
  add(34.0, 1.5, t => (Math.sin(2*Math.PI*1800*t) + noise()*0.8)*Math.exp(-t*3), 0.6);

  // Megaphone click Q (42s)
  add(42.0, 0.4, t => (Math.sin(2*Math.PI*3000*t)*0.4 + noise()*0.3)*Math.exp(-t*12), 0.45);
  // Parallel laser scanning Q*K (48s - 56s)
  for(let t=48.0; t<=56.0; t+=0.8){
    add(t, 0.25, time => Math.sin(2*Math.PI*(1200+time*800)*time)*Math.exp(-time*10), 0.35);
  }
  // High score 88% bell (60s)
  add(60.0, 1.8, t => (Math.sin(2*Math.PI*1046.50*t) + Math.sin(2*Math.PI*1318.51*t)*0.7)*Math.exp(-t*2.5), 0.6);
  // Briefcase latch V (66s)
  add(66.0, 0.5, t => (Math.sin(2*Math.PI*500*t) + noise()*0.5)*Math.exp(-t*8), 0.5);

  // 96 Flashlight ignition surge (82s)
  add(82.0, 2.0, t => (Math.sin(2*Math.PI*180*t)*0.3 + noise()*0.3)*Math.sin(Math.PI*t/2.0), 0.5);
  // Gumball machine marble drop (98s, 106s, 114s)
  [98.0, 106.0, 114.0].forEach(st => {
    add(st, 0.35, t => (Math.sin(2*Math.PI*400*t) + noise()*0.4)*Math.exp(-t*10), 0.5);
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

console.log('2. Starting frame rendering pipeline for Act 3...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep slate blue gradient background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#0A101D');bg.addColorStop(1,'#111C2E');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Grid Floor
    ctx.save();ctx.strokeStyle='rgba(56,189,248,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=500;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // Top HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    let banner = 'ACT 3: THE MAGIC OF ATTENTION (TRANSFORMERS)';
    if(t>=38.0 && t<78.0) banner='THE COCKTAIL PARTY: QUERY, KEY & VALUE DANCE';
    else if(t>=78.0) banner='96 PARALLEL FLASHLIGHTS & SOFTMAX NEXT-TOKEN CHUTE';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: OLD RNN AMNESIA CONVEYOR (0.0s - 38.0s)
    // ---------------------------------------------------------
    if(t < 38.0){
      // Old RNN conveyor belt
      ctx.strokeStyle='#475569';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(120, 360);ctx.lineTo(WIDTH - 120, 360);ctx.stroke();

      // Words on conveyor belt
      const words = ['In', 'the', 'beginning', 'the', 'tired', 'robot', 'had', 'a', 'long', 'sentence', '...'];
      words.forEach((w, idx)=>{
        const wx = 180 + idx * 85 - (t * 25) % 85;
        if(wx > 140 && wx < WIDTH - 140){
          ctx.fillStyle='rgba(30,41,59,0.85)';
          ctx.strokeStyle=(idx === 4 || idx === 5) ? '#38BDF8' : '#64748B';
          ctx.lineWidth=2;
          ctx.beginPath();ctx.roundRect(wx - 35, 330, 70, 40, 8);ctx.fill();ctx.stroke();
          glow(w, wx, 350, 14, '#FFFFFF', 'none', 'center', 'NotoSans');
        }
      });

      // Robot looking through tiny drinking straw (Amnesia)
      drawFigure(ctx,{
        torso: 5, head: 10, facing: 'right',
        armL: [-15, 20], armR: [25, -10], legL: [-10,0], legR:[10,0],
        eyes: 'normal', mouth: 'open', scarf: true
      },{x: 280, y: 520, r: 60});

      // Straw prop
      ctx.strokeStyle='#F5A623';ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(315, 470);ctx.lineTo(365, 365);ctx.stroke();

      // The 2017 Breakthrough Paper reveal (28.0s - 38.0s)
      if(t >= 28.0){
        const sc = t - 28.0;
        const sp = spring(Math.min(1, sc/1.5), 0.65, 8);

        ctx.save();
        ctx.translate(WIDTH/2, 220);
        ctx.scale(sp, sp);
        ctx.fillStyle='rgba(15,23,42,0.95)';
        ctx.strokeStyle='#FEF08A';ctx.lineWidth=3;
        ctx.shadowColor='#FEF08A';ctx.shadowBlur=20;
        ctx.beginPath();ctx.roundRect(-240, -55, 480, 110, 14);ctx.fill();ctx.stroke();

        glow('"ATTENTION IS ALL YOU NEED"', 0, -20, 24, '#FEF08A', '#FEF08A', 'center', 'NotoSans');
        glow('Vaswani et al. (Google Brain, 2017) — Parallel Matrix Attention', 0, 18, 14, '#94A3B8', 'none', 'center', 'NotoSans');
        ctx.restore();
      }

      glow('Old models read sequentially through a straw — Transformers look at ALL words at once!', WIDTH/2, 630, 19, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 2: THE COCKTAIL PARTY (Q, K, V) (38.0s - 78.0s)
    // ---------------------------------------------------------
    else if(t>=38.0 && t<78.0){
      const sc = t - 38.0;

      // Sentence Display at top
      ctx.save();
      ctx.fillStyle='rgba(30,41,59,0.8)';
      ctx.beginPath();ctx.roundRect(140, 130, WIDTH - 280, 60, 10);ctx.fill();
      glow('"The tired robot plugged its cord into the socket because IT was dying."', WIDTH/2, 160, 17, '#FFFFFF', 'none', 'center', 'NotoSans');
      ctx.restore();

      // Center: Word "IT" holding Megaphone QUERY
      const itX = WIDTH/2 - 200;
      drawFigure(ctx,{
        torso: 0, head: 5, facing: 'right',
        armL: [-15, 20], armR: [35, -20], legL: [-10,0], legR:[10,0],
        eyes: 'wide', mouth: 'open', scarf: true
      },{x: itX, y: 520, r: 65});

      // Megaphone Query prop
      ctx.save();
      ctx.translate(itX + 45, 420);
      ctx.fillStyle='#F5A623';ctx.strokeStyle='#D97706';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(45,-20);ctx.lineTo(45,20);ctx.closePath();ctx.fill();ctx.stroke();
      glow('QUERY (Q)', 85, 0, 14, '#F5A623', '#F5A623', 'left', 'NotoSans');
      glow('"Who am I referring to?!"', 85, 22, 13, '#FEF08A', 'none', 'left', 'CaveatHand');
      ctx.restore();

      // Right 1: Word "SOCKET" (Key Badge, 12% match)
      ctx.save();
      ctx.translate(WIDTH - 280, 260);
      ctx.fillStyle='rgba(30,41,59,0.9)';ctx.strokeStyle='#64748B';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.roundRect(-80, -45, 160, 90, 12);ctx.fill();ctx.stroke();
      glow('WORD: "socket"', 0, -22, 14, '#94A3B8', 'none', 'center', 'NotoSans');
      glow('KEY: Wall outlet', 0, 0, 13, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('Match Score: 12%', 0, 24, 14, '#EF4444', 'none', 'center', 'NotoSans');
      ctx.restore();

      // Right 2: Word "ROBOT" (Key Badge, 88% MATCH + Value Briefcase)
      ctx.save();
      ctx.translate(WIDTH - 280, 420);
      ctx.fillStyle='rgba(30,41,59,0.95)';ctx.strokeStyle='#22C55E';ctx.lineWidth=3;
      ctx.shadowColor='#22C55E';ctx.shadowBlur=16;
      ctx.beginPath();ctx.roundRect(-80, -50, 160, 100, 12);ctx.fill();ctx.stroke();
      glow('WORD: "robot"', 0, -25, 15, '#22C55E', '#22C55E', 'center', 'NotoSans');
      glow('KEY: Mechanical entity', 0, -2, 13, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('MATCH SCORE: 88%!', 0, 22, 15, '#4ADE80', '#4ADE80', 'center', 'NotoSans');
      ctx.restore();

      // Laser dot product line connecting IT to ROBOT
      ctx.strokeStyle='rgba(34,197,94,0.7)';ctx.lineWidth=3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();ctx.moveTo(itX + 80, 420);ctx.lineTo(WIDTH - 360, 420);ctx.stroke();
      ctx.setLineDash([]);

      glow('Attention is mathematically: Softmax( (Q · K^T) / √d ) · V', WIDTH/2, 635, 20, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'NotoSans');
    }

    // ---------------------------------------------------------
    // SCENE 3: 96 FLASHLIGHTS & SOFTMAX NEXT-TOKEN CHUTE (78.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 78.0;

      // 96 Attention Head Beams Array
      ctx.save();
      ctx.translate(340, 280);

      glow('MULTI-HEAD ATTENTION: 96 PARALLEL FLASHLIGHTS (GPT-4)', 0, -110, 16, '#38BDF8', '#38BDF8', 'center', 'NotoSans');

      const heads = [
        {role:'Head #1: Grammar & Syntax', color:'#38BDF8'},
        {role:'Head #14: Pronoun Coreference', color:'#A78BFA'},
        {role:'Head #42: Emotional Sentiment', color:'#EC4899'},
        {role:'Head #88: Factual Knowledge', color:'#F5A623'}
      ];

      heads.forEach((h, idx)=>{
        const hy = -60 + idx * 45;
        ctx.fillStyle='rgba(15,23,42,0.9)';
        ctx.strokeStyle=h.color;ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(-220, hy - 16, 440, 34, 8);ctx.fill();ctx.stroke();
        glow(h.role, 0, hy + 2, 14, h.color, 'none', 'center', 'NotoSans');
      });
      ctx.restore();

      // Softmax Gumball Probability Chute (Right side)
      ctx.save();
      ctx.translate(WIDTH - 320, 310);
      ctx.fillStyle='rgba(30,41,59,0.95)';
      ctx.strokeStyle='#22C55E';ctx.lineWidth=3;
      ctx.shadowColor='#22C55E';ctx.shadowBlur=16;
      ctx.beginPath();ctx.roundRect(-140, -140, 280, 280, 16);ctx.fill();ctx.stroke();

      glow('SOFTMAX NEXT-WORD CHUTE', 0, -105, 14, '#94A3B8', 'none', 'center', 'NotoSans');

      const probs = [
        {word:'"recharged"', p:'89.2%', color:'#22C55E'},
        {word:'"exploded"', p:'7.4%', color:'#F5A623'},
        {word:'"danced"', p:'0.001%', color:'#64748B'}
      ];

      probs.forEach((pb, idx)=>{
        const py = -50 + idx * 55;
        glow(pb.word, -50, py, 16, '#FFFFFF', 'none', 'left', 'NotoSans');
        glow(pb.p, 90, py, 16, pb.color, pb.color, 'right', 'monospace');
      });

      glow('Winner: "recharged"', 0, 105, 16, '#FEF08A', '#FEF08A', 'center', 'CaveatHand');
      ctx.restore();

      glow('The Transformer rolls the dice on probabilities, outputs one token, and repeats!', WIDTH/2, 635, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 3 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 3 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});

