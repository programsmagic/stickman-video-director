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
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act5.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act5-MoE-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act5_sfx.wav';
const MIX_FILE = '/tmp/ep02_act5_mix.wav';

console.log(`=== EP02 ACT 5: THE EFFICIENCY MIRACLE (MIXTURE OF EXPERTS) === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 63921;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Heavy steel brain engine chug (1s - 28s)
  add(1.0, 27.0, t => (Math.sin(2*Math.PI*45*t)*0.25 + noise()*0.08)*Math.sin(Math.PI*t/27.0), 0.35);
  // High pressure steam valve hiss (12s, 18s, 24s)
  [12.0, 18.0, 24.0].forEach(st => {
    add(st, 0.8, t => noise()*Math.exp(-t*6), 0.4);
  });
  // Cash register numbers whir (28s)
  add(28.0, 1.5, t => (Math.sin(2*Math.PI*1200*t) + noise()*0.5)*Math.exp(-t*2), 0.45);

  // Restaurant curtain open (35s)
  add(35.0, 1.0, t => noise()*Math.sin(t/1.0*Math.PI), 0.4);
  // Order ticket printer (42s)
  add(42.0, 0.6, t => (Math.sin(2*Math.PI*800*t)*0.4 + noise()*0.5)*Math.exp(-t*8), 0.45);
  // Spotlights turning on (48s, 51s)
  [48.0, 51.0].forEach(st => {
    add(st, 0.4, t => (Math.sin(2*Math.PI*500*t) + noise()*0.3)*Math.exp(-t*10), 0.45);
  });
  // Sizzling pan (54s - 65s)
  add(54.0, 11.0, t => noise()*0.15*Math.sin(Math.PI*t/11.0), 0.3);

  // DeepSeek 95% Slicer Laser (74s)
  add(74.0, 1.2, t => (Math.sin(2*Math.PI*1400*t) + noise()*0.7)*Math.exp(-t*4), 0.6);
  // Coin toss chime & catch (94s, 97s)
  add(94.0, 2.0, t => Math.sin(2*Math.PI*3520*t)*Math.exp(-t*2), 0.5);
  add(97.0, 0.4, t => (Math.sin(2*Math.PI*300*t) + noise()*0.5)*Math.exp(-t*12), 0.5);

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

console.log('2. Starting frame rendering pipeline for Act 5...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep slate background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#0A121E');bg.addColorStop(1,'#0E1E2C');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Floor
    ctx.save();ctx.strokeStyle='rgba(74,222,128,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=500;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // Top HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    let banner = 'ACT 5: THE EFFICIENCY MIRACLE (MIXTURE OF EXPERTS & DEEPSEEK-V3)';
    if(t>=34.0 && t<70.0) banner='THE 64-CHEF KITCHEN: WAKING ONLY THE TOP EXPERTS';
    else if(t>=70.0) banner='DEEPSEEK-V3: 671B TOTAL PARAMS VS 37B ACTIVE (95% POWER SAVED)';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: THE 1,000-TON POWER-HUNGRY STEEL BRAIN (0.0s - 34.0s)
    // ---------------------------------------------------------
    if(t < 34.0){
      // Giant Steel Brain in Center
      ctx.save();
      ctx.translate(WIDTH/2, 280);
      ctx.fillStyle='#334155';ctx.strokeStyle='#64748B';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(0, 0, 110, 0, Math.PI*2);ctx.fill();ctx.stroke();

      // Sweating / smoking indicators
      const smokeY = -120 - (t * 20) % 60;
      ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.beginPath();ctx.arc(-40, smokeY, 16, 0, Math.PI*2);ctx.arc(40, smokeY - 10, 20, 0, Math.PI*2);ctx.fill();

      glow('DENSE MONOLITH (600B PARAMS)', 0, -35, 14, '#EF4444', '#EF4444', 'center', 'NotoSans');
      glow('ALL 600B connections fire for every single word!', 0, 0, 12, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('Electricity Bill: $45,000,000 / month', 0, 35, 13, '#FCA5A5', 'none', 'center', 'NotoSans');
      ctx.restore();

      // Power towers on left and right
      [140, WIDTH - 140].forEach(tx => {
        ctx.fillStyle='#1E293B';ctx.strokeStyle='#EF4444';ctx.lineWidth=2;
        ctx.fillRect(tx - 35, 260, 70, 160);
        ctx.strokeRect(tx - 35, 260, 70, 160);
        glow('⚡ NUCLEAR', tx, 290, 11, '#EF4444', 'none', 'center', 'NotoSans');
      });

      glow('Asking "Capital of France?" shouldn\'t require powering a small nation!', WIDTH/2, 630, 19, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 2: THE 64-CHEF RESTAURANT & ROUTER (34.0s - 70.0s)
    // ---------------------------------------------------------
    else if(t>=34.0 && t<70.0){
      const sc = t - 34.0;

      // Maitre D' Router in Center
      const routerX = 260;
      drawFigure(ctx,{
        torso: 5, head: 5, facing: 'right',
        armL: [-15, 20], armR: [35, -15], legL: [-10,0], legR:[10,0],
        eyes: 'normal', mouth: 'smile', scarf: true
      },{x: routerX, y: 520, r: 65});

      glow('MAITRE D\' ROUTER', routerX, 420, 15, '#F5A623', '#F5A623', 'center', 'NotoSans');

      // Order Ticket
      ctx.fillStyle='#FEF08A';ctx.fillRect(routerX + 45, 340, 140, 60);
      ctx.strokeStyle='#D97706';ctx.lineWidth=2;ctx.strokeRect(routerX + 45, 340, 140, 60);
      glow('ORDER TICKET:', routerX + 115, 355, 11, '#78350F', 'none', 'center', 'NotoSans');
      glow('"Quantum Physics in Spanish"', routerX + 115, 375, 10, '#000000', 'none', 'center', 'NotoSans');

      // The 64-Chef Kitchen Grid (Right side)
      ctx.save();
      ctx.translate(WIDTH - 360, 310);
      ctx.fillStyle='rgba(15,23,42,0.95)';ctx.strokeStyle='#4ADE80';ctx.lineWidth=3;
      ctx.shadowColor='#4ADE80';ctx.shadowBlur=16;
      ctx.beginPath();ctx.roundRect(-240, -160, 480, 320, 16);ctx.fill();ctx.stroke();

      glow('64 SPECIALIZED MASTER CHEFS', 0, -125, 16, '#4ADE80', '#4ADE80', 'center', 'NotoSans');

      const chefs = [
        {name:'Chef #7 (Quantum)', state:'AWAKE & COOKING!', color:'#4ADE80'},
        {name:'Chef #14 (Spanish)', state:'AWAKE & COOKING!', color:'#4ADE80'},
        {name:'Chef #28 (Python)', state:'Sleeping (0 Watts)', color:'#64748B'},
        {name:'Chef #45 (Law)', state:'Sleeping (0 Watts)', color:'#64748B'},
        {name:'Chef #61 (Poetry)', state:'Sleeping (0 Watts)', color:'#64748B'},
        {name:'... 59 Other Chefs', state:'Sleeping peacefully', color:'#475569'}
      ];

      chefs.forEach((ch, idx)=>{
        const cy = -80 + idx * 36;
        glow(ch.name, -200, cy, 14, '#F8FAFC', 'none', 'left', 'NotoSans');
        glow(ch.state, 200, cy, 13, ch.color, 'none', 'right', 'monospace');
      });
      ctx.restore();

      glow('Mixture-of-Experts only wakes the exact 2 or 8 subnetworks needed!', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 3: DEEPSEEK-V3 STATS & 95% POWER DISCOUNT (70.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 70.0;

      // Comparative Bar Chart
      ctx.save();
      ctx.translate(WIDTH/2, 300);

      // Total Parameters Bar (671B)
      ctx.fillStyle='rgba(30,41,59,0.85)';
      ctx.strokeStyle='#64748B';ctx.lineWidth=2;
      ctx.fillRect(-380, -90, 760, 65);
      ctx.strokeRect(-380, -90, 760, 65);
      glow('TOTAL MODEL CAPACITY: 671 BILLION PARAMETERS (Stored in VRAM)', 0, -58, 16, '#F8FAFC', 'none', 'center', 'NotoSans');

      // Active Parameters Bar (37B)
      ctx.fillStyle='rgba(74,222,128,0.9)';
      ctx.strokeStyle='#22C55E';ctx.lineWidth=3;
      ctx.shadowColor='#4ADE80';ctx.shadowBlur=16;
      ctx.fillRect(-380, 15, 760 * 0.055, 65); // 5.5% width
      ctx.strokeRect(-380, 15, 760 * 0.055, 65);

      glow('ACTIVE PER TOKEN: ONLY 37 BILLION (5.5%!)', -120, 48, 16, '#4ADE80', '#4ADE80', 'left', 'NotoSans');
      glow('95% ENERGY SAVINGS!', 280, 48, 18, '#FEF08A', '#FEF08A', 'center', 'CaveatHand');
      ctx.restore();

      // Open-Weight Global Revolution Callout
      ctx.save();
      ctx.fillStyle='rgba(15,23,42,0.85)';
      ctx.beginPath();ctx.roundRect(140, 480, WIDTH - 280, 100, 12);ctx.fill();
      glow('THE OPEN-WEIGHT REVOLUTION (DeepSeek & Qwen):', WIDTH/2, 505, 16, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glow('Frontier intelligence no longer requires a $100M supercluster.', WIDTH/2, 535, 14, '#CBD5E1', 'none', 'center', 'NotoSans');
      glow('Smarter algorithms and sparse routing beat brute force!', WIDTH/2, 560, 15, '#4ADE80', 'none', 'center', 'CaveatHand');
      ctx.restore();

      glow('Intelligence is not about how many weights you have — it\'s about which weights you use!', WIDTH/2, 640, 19, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 5 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 5 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});

