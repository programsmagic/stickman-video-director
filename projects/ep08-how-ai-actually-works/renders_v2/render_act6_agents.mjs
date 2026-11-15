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
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/act6.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-Act6-Autonomous-Masterpiece.mp4');
const SFX_FILE = '/tmp/ep02_act6_sfx.wav';
const MIX_FILE = '/tmp/ep02_act6_mix.wav';

console.log(`=== EP02 ACT 6: AUTONOMOUS AGENTS & THE MIRACLE OF SAND === Duration: ${dur.toFixed(2)}s | Frames: ${TOTAL_FRAMES}`);

// ---- PROCEDURAL FOLEY ----
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const s = new Float32Array(n);
  let seed = 81924;
  const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; };
  const add = (t0, len, fn, g=0.3) => {
    const i0 = Math.round(t0*rate), cnt = Math.min(n-i0, Math.round(len*rate));
    for(let i=0;i<cnt;i++) if(i0+i>=0 && i0+i<n) s[i0+i]+=fn(i/rate)*g;
  };

  // Glass jar unlatch pop (12.0s)
  add(12.0, 0.4, t => (Math.sin(2*Math.PI*900*t) + noise()*0.4)*Math.exp(-t*15), 0.5);
  // Robotic arm snap & lock (18.0s, 22.0s)
  [18.0, 22.0].forEach(st => {
    add(st, 0.5, t => (Math.sin(2*Math.PI*300*t) + noise()*0.6)*Math.exp(-t*8), 0.45);
  });
  // Fast mechanical typing bursts (26s - 34s)
  for(let t=26.0; t<=34.0; t+=0.15){
    add(t, 0.04, time => noise()*Math.exp(-time*80), 0.2);
  }

  // ReAct circuit activation hum (40.0s - 75.0s)
  add(40.0, 35.0, t => (Math.sin(2*Math.PI*60*t)*0.15 + noise()*0.03)*Math.sin(Math.PI*t/35.0), 0.25);
  // Terminal error beep (46s)
  add(46.0, 0.3, t => Math.sin(2*Math.PI*440*t)*Math.exp(-t*8), 0.4);
  // Terminal success verification chime (62s)
  add(62.0, 1.8, t => (Math.sin(2*Math.PI*523.25*t) + Math.sin(2*Math.PI*659.25*t)*0.7 + Math.sin(2*Math.PI*783.99*t)*0.5)*Math.exp(-t*2.5), 0.55);

  // Deep space ethereal swell (80s - 120s)
  add(80.0, 40.0, t => {
    return (Math.sin(2*Math.PI*55*t)*0.2 + Math.sin(2*Math.PI*110*t)*0.1 + noise()*0.02) * 0.4;
  }, 0.3);

  // Celestial lightning thunder strike (94s)
  add(94.0, 4.0, t => (Math.sin(2*Math.PI*45*t) + noise()*0.8)*Math.exp(-t*1.5), 0.75);

  // Grand finale chime cascade & wand sparkle (105s - 120s)
  add(105.0, 14.0, t => {
    const env = Math.exp(-t*0.18);
    return (
      Math.sin(2*Math.PI*261.63*t)*0.35 +
      Math.sin(2*Math.PI*329.63*t)*0.30 +
      Math.sin(2*Math.PI*392.00*t)*0.25 +
      Math.sin(2*Math.PI*523.25*t)*0.20 +
      Math.sin(2*Math.PI*659.25*t)*0.15
    ) * env;
  }, 0.65);

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

console.log('2. Starting frame rendering pipeline for Act 6...');

// Precompute starfield for cosmic finale
const STARS = Array.from({ length: 150 }, (_, i) => ({
  x: ((i * 181 + 47) % WIDTH),
  y: ((i * 287 + 91) % (HEIGHT - 100)),
  r: 0.8 + ((i * 7) % 10) / 6,
  twinkle: (i * 13) % 100
}));

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep cosmic space background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#050811');bg.addColorStop(0.6,'#0A1020');bg.addColorStop(1,'#111827');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Stars
    STARS.forEach((s)=>{
      const alpha = 0.25 + 0.75 * Math.sin(t*2 + s.twinkle);
      ctx.fillStyle=`rgba(255,255,255,${alpha})`;
      ctx.beginPath();ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);ctx.fill();
    });

    // Floor
    ctx.save();ctx.strokeStyle='rgba(56,189,248,0.08)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,490);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=500;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // Top HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 34, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');

    let banner = 'ACT 6: THE AUTONOMOUS AGENT (TOOLS, HANDS & EYES)';
    if(t>=38.0 && t<78.0) banner='THE REACT FEEDBACK LOOP: OBSERVE ➔ REASON ➔ ACT ➔ VERIFY';
    else if(t>=78.0) banner='THE MIRACLE OF SILICON: WE TAUGHT BEACH SAND HOW TO PAY ATTENTION';
    glow(banner, WIDTH/2, 74, 20, '#E2E8F0', 'rgba(255,255,255,0.18)', 'center', 'NotoSans');

    // ---------------------------------------------------------
    // SCENE 1: UNCAGING THE BRAIN IN A JAR (0.0s - 38.0s)
    // ---------------------------------------------------------
    if(t < 38.0){
      // Glass Bell Jar Center
      ctx.save();
      ctx.translate(WIDTH/2, 280);

      // Glass Dome
      ctx.fillStyle='rgba(56,189,248,0.08)';
      ctx.strokeStyle='#38BDF8';ctx.lineWidth=3;
      ctx.shadowColor='#38BDF8';ctx.shadowBlur=16;
      ctx.beginPath();ctx.arc(0, 0, 80, Math.PI, 0);ctx.lineTo(80, 80);ctx.lineTo(-80, 80);ctx.closePath();
      ctx.fill();ctx.stroke();

      // Brain floating inside
      ctx.fillStyle='#EC4899';
      ctx.shadowColor='#EC4899';ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(0, 20, 42, 0, Math.PI*2);ctx.fill();
      glow('PASSIVE CHATBOT', 0, 15, 12, '#FFFFFF', 'none', 'center', 'NotoSans');
      glow('(Brain in a Jar)', 0, 32, 11, '#FEF08A', 'none', 'center', 'CaveatHand');
      ctx.restore();

      // Robot hands & camera goggle equipping transition (20.0s - 38.0s)
      if(t >= 20.0){
        ctx.save();
        ctx.fillStyle='rgba(30,41,59,0.92)';
        ctx.strokeStyle='#F5A623';ctx.lineWidth=3;
        ctx.shadowColor='#F5A623';ctx.shadowBlur=16;
        ctx.beginPath();ctx.roundRect(WIDTH/2 - 240, 400, 480, 70, 12);ctx.fill();ctx.stroke();

        glow('EQUIPPED WITH AGENCY: Camera (Eyes) + Terminal (Hands)', WIDTH/2, 424, 15, '#F5A623', '#F5A623', 'center', 'NotoSans');
        glow('Claude Computer Use, Devin, Cline, and Antigravity Agents', WIDTH/2, 450, 13, '#CBD5E1', 'none', 'center', 'NotoSans');
        ctx.restore();
      }

      glow('A recipe is useless without hands to cook — agents can execute code!', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 2: THE ENDLESS REACT LOOP (38.0s - 78.0s)
    // ---------------------------------------------------------
    else if(t>=38.0 && t<78.0){
      const sc = t - 38.0;

      // Circular ReAct Track on Floor / Center
      ctx.save();
      ctx.translate(WIDTH/2, 290);

      // Rotating loop glow
      ctx.strokeStyle='rgba(56,189,248,0.25)';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(0, 0, 150, 0, Math.PI*2);ctx.stroke();

      const loopSteps = [
        {name:'1. OBSERVE', sub:'Read Screen & Logs', color:'#38BDF8', angle:0},
        {name:'2. REASON', sub:'Thinking Scratchpad', color:'#A78BFA', angle:Math.PI/2},
        {name:'3. ACT', sub:'Execute Terminal Tool', color:'#F5A623', angle:Math.PI},
        {name:'4. VERIFY', sub:'Check Test Status', color:'#22C55E', angle:3*Math.PI/2}
      ];

      loopSteps.forEach(ls => {
        const lx = Math.cos(ls.angle) * 150;
        const ly = Math.sin(ls.angle) * 150;
        ctx.fillStyle='rgba(15,23,42,0.95)';
        ctx.strokeStyle=ls.color;ctx.lineWidth=3;
        ctx.shadowColor=ls.color;ctx.shadowBlur=14;
        ctx.beginPath();ctx.roundRect(lx - 75, ly - 35, 150, 70, 12);ctx.fill();ctx.stroke();
        glow(ls.name, lx, ly - 10, 15, ls.color, ls.color, 'center', 'NotoSans');
        glow(ls.sub, lx, ly + 14, 11, '#CBD5E1', 'none', 'center', 'NotoSans');
      });

      // Center Agent Stickman
      drawFigure(ctx,{
        torso: 0, head: 0, facing: 'front',
        armL: [-25, 20], armR: [25, 20], legL: [-10,0], legR:[10,0],
        eyes: 'wide', mouth: 'smile', scarf: true
      },{x: 0, y: 35, r: 50});
      ctx.restore();

      glow('Self-healing loops: If an error occurs, the agent reads the bug and tries again!', WIDTH/2, 630, 20, '#FEF08A', 'none', 'center', 'CaveatHand');
    }

    // ---------------------------------------------------------
    // SCENE 3: THE GRAND FINALE (BEACH SAND TO GALAXY) (78.0s - end)
    // ---------------------------------------------------------
    else {
      const sc = t - 78.0;

      // Asteroid Cliff on Left
      ctx.fillStyle='#0F172A';
      ctx.beginPath();ctx.moveTo(0, 420);ctx.lineTo(440, 420);ctx.lineTo(380, HEIGHT);ctx.lineTo(0, HEIGHT);ctx.fill();
      ctx.strokeStyle='#1E293B';ctx.lineWidth=3;ctx.stroke();

      // Magi holding a glowing palm of sand
      drawFigure(ctx,{
        torso: 5, head: -10, facing: 'right',
        armL: [-15, 20], armR: [35, -25], legL: [-10,0], legR:[10,0],
        eyes: 'normal', mouth: 'smile', scarf: true
      },{x: 350, y: 420, r: 65});

      // Golden sparkling sand particles rising from palm
      const palmX = 410, palmY = 345;
      for(let p=0; p<12; p++){
        const py = palmY - ((sc * 35 + p * 15) % 180);
        const px = palmX + Math.sin(sc*3 + p)*25;
        const alpha = Math.max(0, 1 - (palmY - py) / 200);
        ctx.fillStyle=`rgba(254,240,138,${alpha})`;
        ctx.shadowColor='#F59E0B';ctx.shadowBlur=12;
        ctx.beginPath();ctx.arc(px, py, 3, 0, Math.PI*2);ctx.fill();
      }

      // Swirling golden galaxy on right side
      ctx.save();
      ctx.translate(WIDTH - 380, 290);
      ctx.rotate(sc * 0.1);
      const galGrad = ctx.createRadialGradient(0,0,10, 0,0,220);
      galGrad.addColorStop(0, 'rgba(245,158,11,0.3)');
      galGrad.addColorStop(0.5, 'rgba(56,189,248,0.15)');
      galGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle=galGrad;
      ctx.beginPath();ctx.ellipse(0, 0, 220, 100, 0, 0, Math.PI*2);ctx.fill();
      ctx.restore();

      // Final Grand Statement
      ctx.save();
      ctx.fillStyle='rgba(15,23,42,0.95)';
      ctx.strokeStyle='#FEF08A';ctx.lineWidth=3;
      ctx.shadowColor='#FEF08A';ctx.shadowBlur=22;
      ctx.beginPath();ctx.roundRect(WIDTH/2 - 380, 480, 760, 120, 16);ctx.fill();ctx.stroke();

      glow('WE TAUGHT MELTED BEACH SAND HOW TO PAY ATTENTION.', WIDTH/2, 515, 22, '#FEF08A', '#FEF08A', 'center', 'NotoSans');
      glow('AI is not black magic. It is humanity\'s greatest mirror.', WIDTH/2, 550, 16, '#F8FAFC', 'none', 'center', 'NotoSans');
      glow('Next Episode: Episode 03 — Can AI Ever Become Conscious?', WIDTH/2, 578, 15, '#38BDF8', 'none', 'center', 'CaveatHand');
      ctx.restore();

      glow('@programsmagic | Artificial Intelligence: From Sand to Silicon', WIDTH/2, 655, 15, '#94A3B8', 'none', 'center', 'NotoSans');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin, 'drain');

    if(frame % 250 === 0 || frame === TOTAL_FRAMES - 1){
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 6 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 6 Render Complete! Output: ${OUTPUT}`);
}

render().catch(e=>{console.error(e); process.exit(1);});

