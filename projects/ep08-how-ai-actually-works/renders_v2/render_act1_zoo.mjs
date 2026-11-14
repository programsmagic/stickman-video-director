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
    for(let i=0;i<cnt;i++) if(i0+i>=0) s[i0+i]+=fn(i/rate)*g;
  };

  // 0:01 Neon hum
  add(0.1, 20.0, t => (noise()*0.08+Math.sin(2*Math.PI*120*t)*0.12)*Math.min(1,t*2)*Math.min(1,(20-t)), 0.3);
  // Ticker clicks
  for(let t=0.5;t<18;t+=0.08) add(t, 0.03, time => noise()*Math.exp(-time*120), 0.2);
  // Billboard orbit swoosh (0.14s)
  add(0.14, 0.8, t => noise()*Math.sin(t/0.8*Math.PI), 0.4);
  // Wrench CLANG (0.18s)
  add(0.18, 2.0, t => (Math.sin(2*Math.PI*440*t)+Math.sin(2*Math.PI*880*t)*0.5)*Math.exp(-t*3), 0.65);
  // Power-down sweep (0.20s)
  add(0.20, 1.5, t => Math.sin(2*Math.PI*(800-t*500)*t)*Math.exp(-t*2), 0.5);
  // Hydraulic hiss (0.26s)
  add(0.26, 0.4, t => (noise()*0.6+Math.sin(2*Math.PI*1000*t)*0.3)*Math.exp(-t*8), 0.45);
  // Magnifying lens ping (0.31s)
  add(0.31, 1.0, t => Math.sin(2*Math.PI*2400*t)*Math.exp(-t*5), 0.4);
  // Deep zoom whoosh (0.36s)
  add(0.36, 1.5, t => noise()*Math.sin(t/1.5*Math.PI), 0.5);
  // 3-step chimes (0.41s, 0.44s, 0.47s)
  [[0.41,523.25],[0.44,659.25],[0.47,783.99]].forEach(([st,f]) => {
    add(st, 0.8, t => Math.sin(2*Math.PI*f*t)*Math.exp(-t*4), 0.5);
  });
  // Roulette ratchet (0.47s)
  for(let t=0.47;t<0.65;t+=0.03) add(t, 0.02, time => noise()*Math.exp(-time*80), 0.3);
  // 4 terrarium lifts (0.52s, 0.56s, 1.01s, 1.06s)
  [0.52,0.56,1.01,1.06].forEach(st => add(st, 0.3, t => (noise()*0.3+Math.sin(2*Math.PI*200*t)*0.5)*Math.exp(-t*8), 0.4));
  // Auctioneer gavel (0.56s)
  for(let t=0.56;t<0.70;t+=0.08) add(t, 0.05, time => (noise()*0.4+Math.sin(2*Math.PI*600*time)*0.6)*Math.exp(-time*60), 0.35);
  // Snoring (1.06s)
  add(1.06, 0.6, t => Math.sin(2*Math.PI*(80+Math.sin(t*8)*20)*t)*Math.sin(Math.PI*t/0.6), 0.25);
  // Robot servo (1.11s)
  add(1.11, 0.5, t => (Math.sin(2*Math.PI*(400+t*300)*t)*0.5+noise()*0.3)*Math.exp(-t*4), 0.4);
  // Cinematic sub-drop (1.14s)
  add(1.14, 1.5, t => Math.sin(2*Math.PI*45*t)*Math.exp(-t*1.2), 0.65);

  const bytes = Buffer.alloc(44+n*2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(rate,24); bytes.writeUInt32LE(rate*2,28); bytes.writeUInt16LE(2,32);
  bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++) bytes.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(s[i]*32767))),44+i*2);
  fs.writeFileSync(SFX_FILE, bytes);
}
execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.70[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${MIX_FILE}"`);
console.log('✓ Audio mixed.');

// ---- FFMPEG PIPELINE ----
const ffmpeg = spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${WIDTH}x${HEIGHT}`,'-r',`${FPS}`,'-i','pipe:0','-i',MIX_FILE,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest',OUTPUT],{stdio:['pipe','inherit','inherit']});
const canvas = createCanvas(WIDTH, HEIGHT), ctx = canvas.getContext('2d');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

function glow(text,x,y,size,color,gc,align='center',font='NotoSans'){
  ctx.save();ctx.font=`bold ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';
  if(gc&&gc!=='none'){ctx.shadowColor=gc;ctx.shadowBlur=14;}
  ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
}

console.log('2. Rendering frames...');

async function render(){
  for(let frame=0;frame<TOTAL_FRAMES;frame++){
    const t=frame/FPS;
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Deep obsidian background
    const bg=ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,'#07090E');bg.addColorStop(1,'#0E131D');
    ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Grid floor
    ctx.save();ctx.strokeStyle='rgba(56,189,248,0.07)';ctx.lineWidth=1;
    for(let x=-200;x<=WIDTH+200;x+=90){ctx.beginPath();ctx.moveTo(x,480);ctx.lineTo((x-WIDTH/2)*2.8+WIDTH/2,HEIGHT);ctx.stroke();}
    for(let y=490;y<=HEIGHT;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.restore();

    // TOP SERIES HUD
    glow('EPISODE 02 — HOW AI ACTUALLY WORKS', WIDTH/2, 32, 18, '#38BDF8', 'rgba(56,189,248,0.4)', 'center', 'CaveatHand');
    // Sub-banner
    let banner = 'THE MODERN AI ZOO: ONE RECIPE, FOUR SPECIES';
    if(t>=0.24&&t<0.5) banner='THE UNIVERSAL 3-STEP RECIPE: WORDS > NUMBERS > PROBABILITIES';
    else if(t>=0.5) banner='MEET THE FOUR SPECIES OF MODERN ARTIFICIAL INTELLIGENCE';
    glow(banner, WIDTH/2, 72, 20, '#E2E8F0', 'rgba(255,255,255,0.15)', 'center', 'NotoSans');

    // ---- SCENE 1: NEON BRAND BLIZZARD (0.0s - 0.24s) ----
    if(t < 0.24){
      const names=['ChatGPT','Gemini','Claude','DeepSeek','Llama','Grok','Qwen','Mistral'];
      names.forEach((name,i)=>{
        const angle = (t*2+i*Math.PI/4);
        const r = 240+Math.sin(t*3+i)*30;
        const bx = WIDTH/2+Math.cos(angle)*r;
        const by = 320+Math.sin(angle*0.7)*80;
        const alpha = 0.6+Math.sin(t*8+i)*0.3;
        ctx.save();
        ctx.fillStyle=`rgba(15,23,42,${alpha*0.9})`;
        ctx.strokeStyle=['#38BDF8','#F5A623','#A78BFA','#4ADE80','#F87171','#FBBF24','#60A5FA','#34D399'][i%8];
        ctx.lineWidth=2;
        ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=10;
        ctx.beginPath();ctx.roundRect(bx-50,by-18,100,36,8);ctx.fill();ctx.stroke();
        glow(name,bx,by,15,ctx.strokeStyle,'none','center','NotoSans');
        ctx.restore();
      });

      // Magi center (overwhelmed)
      drawFigure(ctx,{torso:0,head:0,facing:'front',armL:[-45,15],armR:[45,15],legL:[-12,0],legR:[12,0],eyes:'wide',mouth:'open',scarf:true},{x:WIDTH/2,y:490,r:65});
      glow('"What IS all this?!"', WIDTH/2, 380, 20, '#FEF08A','rgba(254,240,138,0.4)','center','CaveatHand');
    }

    // ---- SCENE 2: SILICON ENGINE 3-STEP RECIPE (0.24s - 0.5s) ----
    else if(t>=0.24&&t<0.5){
      const sc=t-0.24;

      // Server rack
      ctx.fillStyle='#111827';ctx.strokeStyle='#38BDF8';ctx.lineWidth=3;
      ctx.strokeRect(WIDTH/2-100,160,200,300);ctx.fillRect(WIDTH/2-100,160,200,300);
      // AI logos on rack
      ['ChatGPT','Gemini','DeepSeek','Claude'].forEach((n,i)=>{
        glow(n, WIDTH/2, 200+i*55, 14,'#64748B','none','center','NotoSans');
      });

      // The 3-Step Pipeline visualization
      const pipeX = [WIDTH/2-320, WIDTH/2, WIDTH/2+320];
      const labels = ['WORDS\n→ TOKENS','WEIGHTS\nMULTIPLY','PREDICT\nNEXT WORD'];
      const colors = ['#38BDF8','#A78BFA','#4ADE80'];
      labels.forEach((lbl,i)=>{
        const sx = spring(Math.max(0,sc-i*0.04), 0.65, 10);
        ctx.save();ctx.translate(pipeX[i], 400);ctx.scale(sx,sx);
        ctx.fillStyle='rgba(15,23,42,0.9)';ctx.strokeStyle=colors[i];ctx.lineWidth=3;
        ctx.shadowColor=colors[i];ctx.shadowBlur=15;
        ctx.beginPath();ctx.roundRect(-75,-55,150,110,12);ctx.fill();ctx.stroke();
        lbl.split('\n').forEach((line,li)=>glow(line,0,-15+li*30,16,colors[i],'none','center','NotoSans'));
        ctx.restore();
        // Arrows between boxes
        if(i<2){
          ctx.strokeStyle=colors[i];ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(pipeX[i]+80,400);ctx.lineTo(pipeX[i]+160,400);
          ctx.lineTo(pipeX[i]+152,393);ctx.moveTo(pipeX[i]+160,400);ctx.lineTo(pipeX[i]+152,407);
          ctx.stroke();
        }
      });

      glow('THE UNIVERSAL 3-STEP RECIPE (Shared by ALL modern AI)', WIDTH/2, 530, 18,'#FFFFFF','rgba(255,255,255,0.3)','center','NotoSans');

      // Magi with magnifying glass
      drawFigure(ctx,{torso:5,head:8,facing:'right',armL:[-15,20],armR:[30,-15],legL:[-10,0],legR:[10,0],eyes:'normal',mouth:'smile',scarf:true},{x:220,y:490,r:60});
    }

    // ---- SCENE 3: 4 SPECIES TERRARIUMS (0.5s - end) ----
    else {
      const sc=t-0.5;
      const specs=[
        {label:'Species 1', name:'THE FAST AUCTIONEER',sub:'GPT-4o, Gemini Flash',color:'#38BDF8',cx:220,desc:'Next-Token\nPredictor'},
        {label:'Species 2', name:'THE CHESS DETECTIVE',sub:'OpenAI o1, DeepSeek-R1',color:'#A78BFA',cx:500,desc:'Reasoning\nModel'},
        {label:'Species 3', name:'THE 64-CHEF KITCHEN',sub:'DeepSeek-V3 MoE',color:'#4ADE80',cx:780,desc:'Mixture of\nExperts'},
        {label:'Species 4', name:'THE AUTONOMOUS AGENT',sub:'Claude, Devin',color:'#F5A623',cx:1060,desc:'Tool-Use\nAgent'},
      ];

      specs.forEach((sp,i)=>{
        const popSpring = spring(Math.max(0,sc-i*0.08), 0.65, 9);
        ctx.save();ctx.translate(sp.cx,340);ctx.scale(popSpring,popSpring);

        // Booth glass
        ctx.fillStyle='rgba(15,23,42,0.85)';ctx.strokeStyle=sp.color;ctx.lineWidth=3;
        ctx.shadowColor=sp.color;ctx.shadowBlur=18;
        ctx.beginPath();ctx.roundRect(-125,-180,250,360,14);ctx.fill();ctx.stroke();

        // Top species badge
        glow(sp.label,0,-155,13,'#94A3B8','none','center','NotoSans');
        glow(sp.name,0,-125,13,sp.color,sp.color,'center','NotoSans');

        // Simple mascot icon
        const iconColors=[['#38BDF8','#FEF08A'],['#A78BFA','#D4AF37'],['#4ADE80','#FCD34D'],['#F5A623','#60A5FA']];
        ctx.fillStyle=iconColors[i][0];ctx.shadowColor=iconColors[i][0];ctx.shadowBlur=15;
        ctx.beginPath();ctx.arc(0,-35,38,0,Math.PI*2);ctx.fill();
        // Icon details
        if(i===0){// auctioneer gavel
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=5;
          ctx.beginPath();ctx.moveTo(-20,-55);ctx.lineTo(20,-15);ctx.stroke();
          ctx.beginPath();ctx.arc(20,-15,8,0,Math.PI*2);ctx.fill();
        } else if(i===1){// detective magnifying glass
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;
          ctx.beginPath();ctx.arc(-5,-40,18,0,Math.PI*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(8,-28);ctx.lineTo(20,-15);ctx.stroke();
        } else if(i===2){// chef hat
          ctx.fillStyle='#FFFFFF';
          ctx.beginPath();ctx.ellipse(0,-55,25,12,0,0,Math.PI*2);ctx.fill();
          ctx.fillRect(-20,-55,40,20);
        } else {// robot hand
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;
          ctx.strokeRect(-15,-52,30,32);
          ctx.beginPath();ctx.moveTo(-15,-20);ctx.lineTo(-25,-5);
          ctx.moveTo(15,-20);ctx.lineTo(25,-5);
          ctx.stroke();
        }

        // Model names
        glow(sp.sub,0,30,12,'#CBD5E1','none','center','NotoSans');
        // Description chips
        sp.desc.split('\n').forEach((d,li)=>glow(d,0,70+li*22,13,sp.color,'none','center','CaveatHand'));
        ctx.restore();
      });

      glow('All built on the same 3-step engine — just specialized differently', WIDTH/2, 640, 20,'#94A3B8','none','center','CaveatHand');
    }

    const rawBytes = Buffer.from(canvas.data());
    const ok = ffmpeg.stdin.write(rawBytes);
    if(!ok) await once(ffmpeg.stdin,'drain');
    if(frame%200===0||frame===TOTAL_FRAMES-1) console.log(`Act1: ${((frame/TOTAL_FRAMES)*100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
  ffmpeg.stdin.end();
  await once(ffmpeg,'close');
  console.log(`\n🎉 Act 1 Complete! → ${OUTPUT}`);
}

render().catch(e=>{console.error(e);process.exit(1);});

