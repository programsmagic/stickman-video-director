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
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act2.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act2-Coordinates-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act2_sfx.wav';
const MIX_FILE = '/tmp/ep02_act2_mix.wav';

console.log(`=== EP02 ACT 2: HOW WORDS BECOME GPS COORDINATES === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 39182;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Typewriter key clacks (1.5s - 10.0s)
  for(let t=1.5; t<=9.5; t+=0.35) add(t, 0.05, time => (noise()*0.6 + Math.sin(2*Math.PI*2200*time)*0.4)*Math.exp(-time*90), 0.35);
  // Electrical buzzer sparks (10.5s)
  add(10.5, 0.6, t => (Math.sin(2*Math.PI*150*t) + noise()*0.7)*Math.exp(-t*4), 0.55);

  // Cartoon buzzer "Two!" (18.0s)
  add(18.0, 0.8, t => (Math.sin(2*Math.PI*(400-t*200)*t) + noise()*0.3)*Math.exp(-t*3), 0.5);

  // Guillotine blade drops (28.0s, 31.0s, 34.0s)
  [28.0, 31.0, 34.0].forEach(st => {
    add(st, 0.4, t => (Math.sin(2*Math.PI*120*t) + noise()*0.8)*Math.exp(-t*10), 0.6);
  });

  // Jetpack ignition & supermarket reveal (42.0s - 45.0s)
  add(42.0, 3.5, t => (noise()*0.3 + Math.sin(2*Math.PI*(180+t*100)*t)*0.2)*Math.sin(Math.PI*t/3.5), 0.45);
  // Supermarket checkout beeps (50s, 56s, 64s, 72s)
  [50.0, 56.0, 64.0, 72.0].forEach(st => {
    add(st, 0.15, t => Math.sin(2*Math.PI*2600*t)*Math.exp(-t*20), 0.4);
  });

  // Brass scale clank & weights placed (80s, 86s, 92s)
  [80.0, 86.0, 92.0].forEach(st => {
    add(st, 0.6, t => (Math.sin(2*Math.PI*320*t) + Math.sin(2*Math.PI*640*t)*0.5)*Math.exp(-t*5), 0.55);
  });
  // Vector glide laser sweep (98s - 103s)
  add(98.0, 4.0, t => Math.sin(2*Math.PI*(300+t*350)*t)*0.25*Math.exp(-t*0.5), 0.45);
  // Target hit chime "QUEEN" (103.5s)
  add(103.5, 2.5, t => (Math.sin(2*Math.PI*880*t) + Math.sin(2*Math.PI*1320*t)*0.7)*Math.exp(-t*2), 0.65);

  // Contextual vector snap clicks (112s, 118s)
  [112.0, 118.0].forEach(st => {
    add(st, 0.3, t => Math.sin(2*Math.PI*1800*t)*Math.exp(-t*15), 0.45);
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

console.log('2. Starting frame rendering pipeline for Act 2...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep studio slate background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#0A0F1D');bg.addColorStop(1,'#111827');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Floor
    ctx.save();ctx.strokeStyle='rgba(56,189,248,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=500;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // Top HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    let banner = 'ACT 2: HOW WORDS BECOME NUMBERS (TOKENIZATION & EMBEDDINGS)';
    if(t>=38.0 && t<78.0) banner='THE 12,288-DIMENSIONAL SUPERMARKET OF MEANING';
    else if(t>=78.0) banner='VECTOR ALGEBRA: KING - MAN + WOMAN = QUEEN';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: THE LETTER TRAP & STRAWBERRY PUZZLE (0.0s - 38.0s)
    // ---------------------------------------------------------
    if(t < 38.0){
      // Antique Typewriter on desk
      ctx.fillStyle='#334155';
      ctx.fillRect(WIDTH/2 - 220, 360, 440, 130);
      ctx.strokeStyle='#64748B';ctx.lineWidth=3;
      ctx.strokeRect(WIDTH/2 - 220, 360, 440, 130);

      // Typing letters
      const typed = "S T R A W B E R R Y";
      const charCount = Math.min(typed.length, Math.floor(t * 2));
      glow(typed.slice(0, charCount), WIDTH/2, 395, 24, '#FEF08A', '#F59E0B', 'center', 'monospace');

      // Transistor electrical spark error
      if(t >= 10.0 && t < 22.0){
        ctx.save();
        ctx.fillStyle='rgba(239,68,68,0.92)';
        ctx.strokeStyle='#F87171';
        ctx.lineWidth=3;
        ctx.shadowColor='#EF4444';ctx.shadowBlur=20;
        ctx.beginPath();ctx.roundRect(WIDTH/2 - 240, 150, 480, 80, 14);ctx.fill();ctx.stroke();

        glow('TRANSISTORS CANNOT READ LETTERS!', WIDTH/2, 175, 20, '#FFFFFF', '#EF4444', 'center', 'NotoSans');
        glow('Switches only understand 0 Volts (OFF) or 1 Volt (ON)', WIDTH/2, 205, 14, '#FEE2E2', 'none', 'center', 'NotoSans');
        ctx.restore();
      }

      // Guillotine BPE Tokenizer slicing "strawberry" (22.0s - 38.0s)
      if(t >= 22.0){
        const sc = t - 22.0;
        const bladeSpring = spring(Math.min(1, sc / 2.0), 0.6, 10);

        ctx.save();
        ctx.translate(WIDTH/2, 220);

        // Guillotine frame
        ctx.strokeStyle='#94A3B8';ctx.lineWidth=4;
        ctx.strokeRect(-180, -60, 360, 120);

        // Sliced puzzle tokens
        const tokens = [
          {text:'"straw"', id:'Token #496', color:'#38BDF8', x:-100},
          {text:'"berry"', id:'Token #675', color:'#EC4899', x:100}
        ];

        tokens.forEach(tk => {
          ctx.fillStyle='rgba(30,41,59,0.95)';
          ctx.strokeStyle=tk.color;
          ctx.lineWidth=2.5;
          ctx.shadowColor=tk.color;ctx.shadowBlur=12;
          ctx.beginPath();ctx.roundRect(tk.x - 65, -35, 130, 70, 10);ctx.fill();ctx.stroke();
          glow(tk.text, tk.x, -12, 18, '#FFFFFF', tk.color, 'center', 'NotoSans');
          glow(tk.id, tk.x, 15, 12, tk.color, 'none', 'center', 'monospace');
        });
        ctx.restore();

        glow('WHY THE "r" BUG HAPPENS: The model sees Token IDs, not individual letters!', WIDTH/2, 630, 19, '#F5A623', 'none', 'center', 'CaveatHand');
      }

      // Magi typing at typewriter
      drawFigure(ctx,{
        torso: 10, head: 5, facing: 'right',
        armL: [-10, 20], armR: [25, 10], legL: [-10,0], legR:[10,0],
        eyes: 'normal', mouth: 'smile', scarf: true
      },{x: 240, y: 520, r: 65});
    }

    // ---------------------------------------------------------
    // SCENE 2: THE 12,288-DIMENSIONAL SUPERMARKET (38.0s - 78.0s)
    // ---------------------------------------------------------
    else if(t>=38.0 && t<78.0){
      const sc = t - 38.0;

      // 3D Perspective Supermarket Aisles
      ctx.save();
      ctx.strokeStyle='rgba(56,189,248,0.2)';ctx.lineWidth=2;

      // Produce Aisle (Left)
      ctx.fillStyle='rgba(15,23,42,0.85)';
      ctx.fillRect(80, 150, 320, 320);
      ctx.strokeRect(80, 150, 320, 320);
      glow('AISLE 14: SWEET FRUIT', 240, 180, 16, '#22C55E', '#22C55E', 'center', 'NotoSans');
      const fruits = ['Banana [0.85, 0.12, ...]', 'Apple [0.82, 0.15, ...]', 'Mango [0.89, 0.09, ...]'];
      fruits.forEach((f, idx)=>{
        glow(f, 240, 230 + idx*45, 14, '#FEF08A', 'none', 'center', 'NotoSans');
      });

      // Pharmacy Aisle (Right)
      ctx.fillStyle='rgba(15,23,42,0.85)';
      ctx.fillRect(WIDTH - 400, 150, 320, 320);
      ctx.strokeRect(WIDTH - 400, 150, 320, 320);
      glow('AISLE 88: FIRST AID', WIDTH - 240, 180, 16, '#EC4899', '#EC4899', 'center', 'NotoSans');
      const meds = ['Band-Aid [0.05, 0.94, ...]', 'Aspirin [0.08, 0.91, ...]', 'Gauze [0.03, 0.96, ...]'];
      meds.forEach((m, idx)=>{
        glow(m, WIDTH - 240, 230 + idx*45, 14, '#FBCFE8', 'none', 'center', 'NotoSans');
      });

      // Center Coordinate Axis
      glow('12,288 DIMENSIONS OF MEANING', WIDTH/2, 200, 22, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glow('Words that share meaning sit close together in geometric space.', WIDTH/2, 235, 16, '#94A3B8', 'none', 'center', 'CaveatHand');
      ctx.restore();

      // Magi flying with jetpack in center
      const jetY = 360 + Math.sin(sc*3)*20;
      drawFigure(ctx,{
        torso: -5, head: 5, facing: 'front',
        armL: [-35, 20], armR: [35, 20], legL: [-8, 20], legR: [8, 20],
        eyes: 'wide', mouth: 'open', scarf: true
      },{x: WIDTH/2, y: jetY, r: 60});

      // Jetpack thruster sparks
      ctx.fillStyle='#F59E0B';
      ctx.shadowColor='#F59E0B';ctx.shadowBlur=16;
      ctx.beginPath();
      ctx.arc(WIDTH/2 - 18, jetY + 45, 8 + Math.sin(sc*12)*4, 0, Math.PI*2);
      ctx.arc(WIDTH/2 + 18, jetY + 45, 8 + Math.sin(sc*12)*4, 0, Math.PI*2);
      ctx.fill();

      glow('Distance in vector space = similarity in human meaning', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 3: VECTOR ALGEBRA (KING - MAN + WOMAN = QUEEN) (78.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 78.0;

      // Giant Brass Balance Scale
      ctx.save();
      ctx.translate(WIDTH/2, 290);

      // Central Pillar
      ctx.strokeStyle='#64748B';ctx.lineWidth=6;
      ctx.beginPath();ctx.moveTo(0, -60);ctx.lineTo(0, 140);ctx.stroke();

      // Tilting Beam
      const tilt = Math.sin(sc*1.5)*0.12;
      ctx.rotate(tilt);
      ctx.strokeStyle='#D4AF37';ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(-240, -60);ctx.lineTo(240, -60);ctx.stroke();

      // Equation Boxes
      const eqBlocks = [
        {name:'[ KING ]', sub:'+Royalty, +Male', color:'#F5A623', x:-240},
        {name:'- [ MAN ]', sub:'Plucks Male', color:'#EF4444', x:-100},
        {name:'+ [ WOMAN ]', sub:'Adds Female', color:'#38BDF8', x:100},
        {name:'= [ QUEEN ]', sub:'Crown + Female!', color:'#22C55E', x:240}
      ];

      eqBlocks.forEach(b => {
        ctx.fillStyle='rgba(15,23,42,0.95)';
        ctx.strokeStyle=b.color;ctx.lineWidth=3;
        ctx.shadowColor=b.color;ctx.shadowBlur=14;
        ctx.beginPath();ctx.roundRect(b.x - 60, -30, 120, 60, 10);ctx.fill();ctx.stroke();
        glow(b.name, b.x, -8, 15, '#FFFFFF', b.color, 'center', 'NotoSans');
        glow(b.sub, b.x, 14, 11, b.color, 'none', 'center', 'CaveatHand');
      });
      ctx.restore();

      // Contextual rotation example at bottom
      ctx.save();
      ctx.fillStyle='rgba(30,41,59,0.7)';
      ctx.beginPath();ctx.roundRect(WIDTH/2 - 380, 480, 760, 120, 12);ctx.fill();
      glow('CONTEXTUAL EMBEDDINGS (TRANSFORMER MAGIC):', WIDTH/2, 505, 16, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glow('• "river bank" → Vector tilts toward: WATER, GRASS, MUD [Cosine: 0.92]', WIDTH/2, 540, 14, '#94A3B8', 'none', 'center', 'monospace');
      glow('• "rob a bank" → Vector tilts toward: CASH, VAULT, POLICE [Cosine: 0.94]', WIDTH/2, 570, 14, '#FEF08A', 'none', 'center', 'monospace');
      ctx.restore();

      glow('Words are not frozen definitions — they are vectors steered by context!', WIDTH/2, 645, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 2 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 2 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});

