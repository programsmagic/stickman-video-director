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
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act1.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act1-AI-Zoo-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act1_sfx.wav';
const MIX_FILE = '/tmp/ep02_act1_mix.wav';

console.log(`=== EP02 ACT 1: THE MODERN AI ZOO === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 11847;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Neon hum in background (0-36s)
  add(0.0, 36.0, t => (noise()*0.06 + Math.sin(2*Math.PI*120*t)*0.1) * Math.min(1,t*2) * Math.min(1, 36-t), 0.25);
  // News ticker clicks
  for(let t=1.0; t<34.0; t+=0.18) add(t, 0.04, time => noise()*Math.exp(-time*90), 0.15);
  // Billboards popping into orbit
  [2.0, 6.0, 10.0, 14.0, 18.0, 22.0].forEach((st, idx) => {
    add(st, 0.4, t => Math.sin(2*Math.PI*(400+idx*60)*t)*Math.exp(-t*8), 0.35);
  });
  // Wrench impact CLANG at 34s
  add(34.0, 2.5, t => (Math.sin(2*Math.PI*440*t) + Math.sin(2*Math.PI*880*t)*0.6) * Math.exp(-t*2.5), 0.65);
  add(34.1, 1.2, t => noise()*Math.exp(-t*6), 0.4);

  // Hydraulic server chassis release (38s)
  add(38.0, 0.8, t => (noise()*0.7 + Math.sin(2*Math.PI*800*t)*0.3) * Math.exp(-t*5), 0.45);
  // Silicon zoom whoosh (42s)
  add(42.0, 1.5, t => noise()*Math.sin(t/1.5*Math.PI), 0.5);

  // 3-Step Recipe Chimes (48s, 56s, 64s)
  add(48.0, 1.2, t => (Math.sin(2*Math.PI*523.25*t) + Math.sin(2*Math.PI*659.25*t)*0.6) * Math.exp(-t*3), 0.5);
  add(56.0, 1.2, t => Math.sin(2*Math.PI*(220+Math.sin(t*12)*40)*t) * Math.exp(-t*2), 0.45);
  add(64.0, 1.5, t => (Math.sin(2*Math.PI*783.99*t) + Math.sin(2*Math.PI*1046.50*t)*0.7) * Math.exp(-t*2.5), 0.5);

  // 4 Terrarium pneumatic lifts (76s, 84s, 92s, 100s)
  [76.0, 84.0, 92.0, 100.0].forEach((st, idx) => {
    add(st, 0.6, t => (Math.sin(2*Math.PI*(160+idx*50)*t) + noise()*0.4) * Math.exp(-t*5), 0.45);
  });
  // Gavel tap for auctioneer (78s - 82s)
  for(let t=78.0; t<=82.0; t+=0.4) add(t, 0.05, time => (noise()*0.5 + Math.sin(2*Math.PI*700*time)*0.5)*Math.exp(-time*60), 0.35);
  // Detective scratchpad pencil (86s - 90s)
  for(let t=86.0; t<=90.0; t+=0.15) add(t, 0.04, time => noise()*Math.exp(-time*40), 0.25);
  // Chef kitchen pots (94s)
  add(94.0, 0.8, t => (Math.sin(2*Math.PI*1200*t)*0.4 + noise()*0.5) * Math.exp(-t*6), 0.35);
  // Robot servo whir (102s)
  add(102.0, 0.8, t => Math.sin(2*Math.PI*(350+t*400)*t) * Math.exp(-t*3), 0.4);

  // Grand climax sub-drop (110s)
  add(110.0, 3.5, t => (Math.sin(2*Math.PI*55*t) + Math.sin(2*Math.PI*110*t)*0.5) * Math.exp(-t*0.8), 0.65);

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

console.log('2. Starting frame rendering pipeline for Act 1...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep studio obsidian slate background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#080C14');bg.addColorStop(1,'#0F172A');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Perspective grid floor
    ctx.save();ctx.strokeStyle='rgba(56,189,248,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,480);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=490;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // TOP SERIES HUD (Consistent across all episodes)
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    // SUB-SCENE BANNER
    let banner = 'ACT 1: THE BRAND BLIZZARD & THE MODERN AI ZOO';
    if(t>=36.0&&t<75.0) banner='THE UNIVERSAL 3-STEP ENGINE: WORDS → NUMBERS → PROBABILITIES';
    else if(t>=75.0) banner='THE FOUR SPECIES: AUCTIONEER, DETECTIVE, MOE KITCHEN & AGENT';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: THE NEON BRAND BLIZZARD (0.0s - 36.0s)
    // ---------------------------------------------------------
    if(t < 36.0){
      const names=['ChatGPT','Gemini','Claude','DeepSeek','Llama','Grok','Qwen','Mistral'];
      names.forEach((name,i)=>{
        const angle = (t*0.8 + i*Math.PI/4);
        const r = 260 + Math.sin(t*2 + i)*30;
        const bx = WIDTH/2 + Math.cos(angle)*r;
        const by = 300 + Math.sin(angle*0.8)*90;
        const alpha = 0.7 + Math.sin(t*4 + i)*0.3;
        ctx.save();
        ctx.fillStyle=`rgba(15,23,42,${alpha*0.95})`;
        ctx.strokeStyle=['#38BDF8','#F5A623','#A78BFA','#4ADE80','#F87171','#FBBF24','#60A5FA','#34D399'][i%8];
        ctx.lineWidth=2.5;
        ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=12;
        ctx.beginPath();ctx.roundRect(bx-55,by-20,110,40,8);ctx.fill();ctx.stroke();
        glow(name,bx,by,16,ctx.strokeStyle,'none','center','NotoSans');
        ctx.restore();
      });

      // Ticker tape across screen
      ctx.save();
      ctx.fillStyle='rgba(30,41,59,0.7)';
      ctx.fillRect(0, 110, WIDTH, 28);
      const tickerText = "BREAKING: $100M+ TRAINING RUNS • OPEN-WEIGHT BENCHMARKS EXPLODE • NEW MODEL EVERY 12 HOURS • ARE THEY ALL DIFFERENT?";
      const tickerOffset = (t * 60) % (WIDTH + 600);
      glow(tickerText, WIDTH - tickerOffset, 124, 13, '#94A3B8', 'none', 'left', 'NotoSans');
      ctx.restore();

      // Magi center (holding hands up, overwhelmed)
      const earCoverIK = solve2BoneIK([0,0], [25, -20], 35, 35, 1);
      drawFigure(ctx,{
        torso: 0,
        head: Math.sin(t*3)*5,
        facing: 'front',
        armL: [-40, 20],
        armR: [40, 20],
        legL: [-12, 0],
        legR: [12, 0],
        eyes: 'wide',
        mouth: 'open',
        scarf: true
      },{x:WIDTH/2,y:500,r:65});

      glow('"A brand-new AI born every 12 hours!"', WIDTH/2, 400, 22, '#FEF08A','rgba(254,240,138,0.4)','center','CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 2: THE UNIVERSAL 3-STEP ENGINE (36.0s - 75.0s)
    // ---------------------------------------------------------
    else if(t>=36.0 && t<75.0){
      const sc = t - 36.0;

      // Server Chassis Center
      ctx.fillStyle='#111827';ctx.strokeStyle='#38BDF8';ctx.lineWidth=3;
      ctx.beginPath();ctx.roundRect(WIDTH/2-110, 140, 220, 290, 12);ctx.fill();ctx.stroke();

      // Flashing server status LEDs
      for(let i=0; i<5; i++){
        const ledOn = Math.sin(sc*8 + i) > 0;
        ctx.fillStyle = ledOn ? '#22C55E' : '#1E293B';
        ctx.beginPath();ctx.arc(WIDTH/2 - 80 + i*40, 165, 6, 0, Math.PI*2);ctx.fill();
      }

      // 3-Step Recipe Pipeline Cards
      const pipeX = [WIDTH/2 - 340, WIDTH/2, WIDTH/2 + 340];
      const steps = [
        {title:'STEP 1: TOKENS', sub:'Words → Coordinates\n[0.82, -0.14, 2.71]', color:'#38BDF8'},
        {title:'STEP 2: WEIGHTS', sub:'Multiply Layers\nW · x + b', color:'#A78BFA'},
        {title:'STEP 3: PROBABILITY', sub:'Next-Word Softmax\nP("future") = 89%', color:'#4ADE80'}
      ];

      steps.forEach((st, i)=>{
        const sp = spring(Math.max(0, sc - i*0.8), 0.65, 8);
        ctx.save();
        ctx.translate(pipeX[i], 310);
        ctx.scale(sp, sp);

        ctx.fillStyle='rgba(15,23,42,0.92)';
        ctx.strokeStyle=st.color;
        ctx.lineWidth=3;
        ctx.shadowColor=st.color;
        ctx.shadowBlur=16;
        ctx.beginPath();ctx.roundRect(-95, -75, 190, 150, 14);ctx.fill();ctx.stroke();

        glow(st.title, 0, -45, 16, st.color, st.color, 'center', 'NotoSans');

        // Body content
        st.sub.split('\n').forEach((line, li)=>{
          glow(line, 0, -10 + li*30, 14, '#F8FAFC', 'none', 'center', 'NotoSans');
        });
        ctx.restore();

        // Connecting energetic flow arrows
        if(i < 2){
          ctx.strokeStyle = st.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pipeX[i] + 105, 310);
          ctx.lineTo(pipeX[i] + 235, 310);
          ctx.lineTo(pipeX[i] + 225, 303);
          ctx.moveTo(pipeX[i] + 235, 310);
          ctx.lineTo(pipeX[i] + 225, 317);
          ctx.stroke();
        }
      });

      // Magi holding magnifying glass
      drawFigure(ctx,{
        torso: 6,
        head: 8,
        facing: 'right',
        armL: [-15, 20],
        armR: [32, -18],
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'wide',
        mouth: 'smile',
        scarf: true
      },{x: 200, y: 520, r: 62});

      // Magnifying glass prop
      ctx.save();
      ctx.strokeStyle='#D4AF37';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(260, 420, 24, 0, Math.PI*2);
      ctx.moveTo(245, 435);ctx.lineTo(230, 455);
      ctx.stroke();
      ctx.fillStyle='rgba(56,189,248,0.2)';ctx.fill();
      ctx.restore();

      glow('ALL models share this exact 3-step loop: Words → Math Dials → Probabilities', WIDTH/2, 630, 20, '#FEF08A', 'rgba(254,240,138,0.4)', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 3: THE 4 MODERN AI SPECIES (75.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 75.0;
      const species = [
        {title:'THE AUCTIONEER', role:'Fast Next-Token Speaker', models:'GPT-4o, Gemini Flash', color:'#38BDF8', cx:210},
        {title:'CHESS DETECTIVE', role:'Reasoning & Scratchpad', models:'OpenAI o1, DeepSeek-R1', color:'#A78BFA', cx:490},
        {title:'64-CHEF KITCHEN', role:'Sparse Mixture-of-Experts', models:'DeepSeek-V3 MoE', color:'#4ADE80', cx:770},
        {title:'AUTONOMOUS AGENT', role:'Hands, Eyes & Tools', models:'Claude Computer, Devin', color:'#F5A623', cx:1050}
      ];

      species.forEach((sp, i)=>{
        const popSpring = spring(Math.max(0, sc - i*0.7), 0.65, 8);
        ctx.save();
        ctx.translate(sp.cx, 330);
        ctx.scale(popSpring, popSpring);

        // Glass Booth
        ctx.fillStyle='rgba(15,23,42,0.9)';
        ctx.strokeStyle=sp.color;
        ctx.lineWidth=3;
        ctx.shadowColor=sp.color;
        ctx.shadowBlur=16;
        ctx.beginPath();ctx.roundRect(-120, -170, 240, 340, 16);ctx.fill();ctx.stroke();

        glow(`SPECIES ${i+1}`, 0, -140, 14, '#94A3B8', 'none', 'center', 'NotoSans');
        glow(sp.title, 0, -112, 16, sp.color, sp.color, 'center', 'NotoSans');

        // Central Icon Visual
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();ctx.arc(0, -35, 42, 0, Math.PI*2);ctx.fill();

        // Icon Graphic
        if(i === 0){ // Lightning Gavel
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;
          ctx.beginPath();ctx.moveTo(-18, -55);ctx.lineTo(18, -15);ctx.stroke();
          ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(18, -15, 8, 0, Math.PI*2);ctx.fill();
        } else if(i === 1){ // Magnifying Glass / Scratchpad
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;
          ctx.beginPath();ctx.arc(-6, -42, 16, 0, Math.PI*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(6, -30);ctx.lineTo(18, -18);ctx.stroke();
        } else if(i === 2){ // Chef Hat
          ctx.fillStyle='#FFFFFF';
          ctx.beginPath();ctx.ellipse(0, -52, 22, 12, 0, 0, Math.PI*2);ctx.fill();
          ctx.fillRect(-18, -52, 36, 22);
        } else { // Robot Robotic Claws
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;
          ctx.strokeRect(-16, -50, 32, 28);
          ctx.beginPath();ctx.moveTo(-16, -22);ctx.lineTo(-24, -10);
          ctx.moveTo(16, -22);ctx.lineTo(24, -10);
          ctx.stroke();
        }

        glow(sp.role, 0, 35, 14, '#F8FAFC', 'none', 'center', 'NotoSans');
        glow(sp.models, 0, 65, 12, '#94A3B8', 'none', 'center', 'NotoSans');
        glow('Active in 2026', 0, 100, 14, sp.color, 'none', 'center', 'CaveatHand');
        ctx.restore();
      });

      glow('How does a cold piece of melted sand understand human speech?', WIDTH/2, 630, 22, '#FEF08A', 'rgba(254,240,138,0.4)', 'center', 'CaveatHand');
    }

    // Write frame to ffmpeg stdin
    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 1 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 1 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});
