import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 10;
const TOTAL_FRAMES = FPS * DURATION;
const OUTPUT_FILE = path.resolve('exports/preview-advanced-stickman-10s.mp4');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Helper: draw bezier curve
function drawBezier(ctx, p0, p1, p2, p3, width, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// Draw dynamic contact shadow
function drawShadow(ctx, x, y, radiusX, radiusY, alpha = 0.25) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(2, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(2, radiusX));
  grad.addColorStop(0, `rgba(30, 35, 42, ${alpha})`);
  grad.addColorStop(0.6, `rgba(30, 35, 42, ${alpha * 0.4})`);
  grad.addColorStop(1, 'rgba(30, 35, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// 1. OLD BASIC STICKMAN (Rigid straight lines, no joints, rigid clothes)
function drawOldStickman(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);

  // Rigid legs (straight sticks)
  const walkPhase = Math.sin(t * 5);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  // Left Leg
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(walkPhase * 18 - 15, 0);
  ctx.stroke();

  // Right Leg
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(-walkPhase * 18 + 15, 0);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(0, -140);
  ctx.stroke();

  // Rigid arms
  ctx.beginPath();
  ctx.moveTo(0, -125);
  ctx.lineTo(-walkPhase * 20 - 15, -85);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -125);
  ctx.lineTo(walkPhase * 20 + 15, -85);
  ctx.stroke();

  // Static scarf (rigid rectangle)
  ctx.fillStyle = '#E5A93C';
  ctx.fillRect(-12, -145, 24, 10);
  ctx.beginPath();
  ctx.moveTo(5, -140);
  ctx.lineTo(15, -100);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#E5A93C';
  ctx.stroke();

  // Head
  ctx.fillStyle = '#FFF';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, -170, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes (fixed black dots)
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-8, -172, 2.5, 0, Math.PI * 2);
  ctx.arc(8, -172, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (flat line)
  ctx.beginPath();
  ctx.moveTo(-6, -160);
  ctx.lineTo(6, -160);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wizard hat (rigid polygon)
  ctx.fillStyle = '#5A6375';
  ctx.beginPath();
  ctx.ellipse(0, -188, 32, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-22, -188);
  ctx.lineTo(0, -250);
  ctx.lineTo(22, -188);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// 2. NEW ADVANCED ARTICULATED STICKMAN (Bang-Motion / Hierarchical Joint Rigging)
function drawAdvancedStickman(ctx, x, y, t, options = {}) {
  const { isWalking = true, isTalking = false, headTilt = 0 } = options;

  ctx.save();
  ctx.translate(x, y);

  // Micro-breathing and walk bounce
  const walkSpeed = 5.5;
  const cycle = isWalking ? t * walkSpeed : t * 2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 8 : Math.sin(cycle) * 2;
  const hipY = -70 - bounce;

  // Dynamic Contact Shadow (scales and shifts with bounce)
  const shadowWidth = isWalking ? 42 - bounce * 1.5 : 44 + Math.sin(cycle) * 2;
  drawShadow(ctx, 0, 0, shadowWidth, 8, 0.35 - (bounce / 30));

  // Joint Angles (Inverse Kinematics / Sinusoidal Walk Cycle)
  const legCycle = cycle;
  // Left Leg: Thigh -> Knee -> Calf -> Ankle -> Foot
  const lThighAngle = isWalking ? Math.sin(legCycle) * 0.45 : 0.05;
  const lKneeBend = isWalking ? Math.max(0, Math.cos(legCycle)) * 0.7 + 0.1 : 0.08;

  // Right Leg: Thigh -> Knee -> Calf -> Ankle -> Foot
  const rThighAngle = isWalking ? Math.sin(legCycle + Math.PI) * 0.45 : -0.05;
  const rKneeBend = isWalking ? Math.max(0, Math.cos(legCycle + Math.PI)) * 0.7 + 0.1 : 0.08;

  // Function to draw 2-bone articulated leg with organic Bézier curvature
  function drawArticulatedLeg(thighAngle, kneeBend, isBack) {
    const thighLen = 42;
    const calfLen = 38;
    const hipX = isBack ? -8 : 8;

    const kneeX = hipX + Math.sin(thighAngle) * thighLen;
    const kneeY = hipY + Math.cos(thighAngle) * thighLen;

    const footAngle = thighAngle + kneeBend;
    const footX = kneeX + Math.sin(footAngle) * calfLen;
    const footY = kneeY + Math.cos(footAngle) * calfLen;

    ctx.strokeStyle = isBack ? '#3C424F' : '#1E232A';
    ctx.lineWidth = isBack ? 4.0 : 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Thigh with organic curve
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(hipX + (kneeX - hipX) * 0.4 + 2, hipY + (kneeY - hipY) * 0.5, kneeX, kneeY);
    ctx.stroke();

    // Calf
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.quadraticCurveTo(kneeX + (footX - kneeX) * 0.5, kneeY + (footY - kneeY) * 0.5, footX, footY);
    ctx.stroke();

    // Articulated Foot / Shoe with taper
    ctx.beginPath();
    ctx.moveTo(footX - 2, footY);
    ctx.lineTo(footX + 12, footY);
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Joint circles for subtle realism
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(kneeX, kneeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw back leg first (depth layering)
  drawArticulatedLeg(rThighAngle, rKneeBend, true);

  // Spine & Torso (organic lean + spine curve)
  const spineLean = isWalking ? 0.08 + Math.sin(cycle * 2) * 0.02 : Math.sin(cycle) * 0.02;
  const chestX = Math.sin(spineLean) * 75;
  const chestY = hipY - 75;

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 5.0;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.bezierCurveTo(
    chestX * 0.3 - 4, hipY - 25,
    chestX * 0.7 - 2, hipY - 55,
    chestX, chestY
  );
  ctx.stroke();

  // Draw front leg
  drawArticulatedLeg(lThighAngle, lKneeBend, false);

  // Articulated Arms (Shoulder -> Elbow -> Forearm -> Hand)
  function drawArticulatedArm(shoulderX, shoulderY, armCycle, isFront) {
    const upperArmLen = 36;
    const forearmLen = 32;
    const armAngle = Math.sin(armCycle) * 0.5;
    const elbowBend = 0.35 + Math.sin(armCycle + 0.5) * 0.3;

    const elbowX = shoulderX + Math.sin(armAngle) * upperArmLen;
    const elbowY = shoulderY + Math.cos(armAngle) * upperArmLen;

    const handAngle = armAngle - elbowBend;
    const handX = elbowX + Math.sin(handAngle) * forearmLen;
    const handY = elbowY + Math.cos(handAngle) * forearmLen;

    ctx.strokeStyle = isFront ? '#1E232A' : '#3C424F';
    ctx.lineWidth = isFront ? 4.0 : 3.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Expressive stylized hand (oval + thumb indicator)
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(handX, handY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Back arm
  drawArticulatedArm(chestX - 6, chestY + 12, cycle + Math.PI, false);
  // Front arm
  drawArticulatedArm(chestX + 6, chestY + 12, cycle, true);

  // Secondary Physics: Scarf with Spring Delay & Wind Sway
  const scarfWave = Math.sin(t * 6) * 12;
  const scarfWave2 = Math.cos(t * 8) * 8;
  const scarfX = chestX + 4;
  const scarfY = chestY - 4;

  // Scarf knot
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(scarfX - 16, scarfY - 8, 32, 16, 6);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flowing scarf tails (Bézier curves trailing behind)
  drawBezier(
    ctx,
    { x: scarfX - 6, y: scarfY + 6 },
    { x: scarfX - 25 - bounce, y: scarfY + 22 + scarfWave },
    { x: scarfX - 45 - bounce * 1.5, y: scarfY + 35 + scarfWave2 },
    { x: scarfX - 65, y: scarfY + 45 + scarfWave },
    8,
    '#F59E0B'
  );

  // Neck & Head with Expressive Tilt
  const headX = chestX + Math.sin(headTilt) * 14;
  const headY = chestY - 32;

  // Head base (smooth cream/white fill with clean ink outline)
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(headX, headY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // FACIAL RIG: Blinking, Pupil Tracking, Brows, and Mouth
  const blinkCycle = t % 3.2; // Blinks every 3.2s
  const isBlinking = blinkCycle > 3.05 && blinkCycle < 3.2;

  // Eye gaze tracking (follows subtle horizontal motion)
  const gazeX = Math.sin(t * 1.5) * 3;
  const gazeY = Math.cos(t * 2) * 1.5;

  const leftEyeX = headX - 9;
  const rightEyeX = headX + 9;
  const eyeY = headY - 3;

  if (isBlinking) {
    // Eyelid slit (closed curve)
    ctx.strokeStyle = '#1E232A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 5, eyeY);
    ctx.quadraticCurveTo(leftEyeX, eyeY + 2, leftEyeX + 5, eyeY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightEyeX - 5, eyeY);
    ctx.quadraticCurveTo(rightEyeX, eyeY + 2, rightEyeX + 5, eyeY);
    ctx.stroke();
  } else {
    // Sclera + Pupil + Specular Highlight
    ctx.fillStyle = '#1E232A';
    // Left eye pupil
    ctx.beginPath();
    ctx.arc(leftEyeX + gazeX, eyeY + gazeY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Specular highlight (white dot)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEyeX + gazeX - 1, eyeY + gazeY - 1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Right eye pupil
    ctx.fillStyle = '#1E232A';
    ctx.beginPath();
    ctx.arc(rightEyeX + gazeX, eyeY + gazeY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Specular highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(rightEyeX + gazeX - 1, eyeY + gazeY - 1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Eyebrows (react to emotion)
    ctx.strokeStyle = '#1E232A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 6, eyeY - 8 + Math.sin(t * 2) * 1.5);
    ctx.lineTo(leftEyeX + 5, eyeY - 7);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightEyeX - 5, eyeY - 7);
    ctx.lineTo(rightEyeX + 6, eyeY - 8 + Math.sin(t * 2) * 1.5);
    ctx.stroke();
  }

  // Iconic Round Spectacles
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(leftEyeX, eyeY, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rightEyeX, eyeY, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  // Bridge between glasses
  ctx.beginPath();
  ctx.moveTo(leftEyeX + 8.5, eyeY);
  ctx.lineTo(rightEyeX - 8.5, eyeY);
  ctx.stroke();

  // Dynamic Expressive Mouth (speech phoneme or subtle smile)
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 2.5;
  const mouthOpen = isTalking ? Math.abs(Math.sin(t * 12)) * 6 : 0;
  if (mouthOpen > 2) {
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.ellipse(headX, headY + 12, 5, mouthOpen, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY + 11);
    ctx.quadraticCurveTo(headX, headY + 14 + Math.sin(t * 2) * 1.5, headX + 6, headY + 11);
    ctx.stroke();
  }

  // WIZARD HAT WITH SECONDARY TIP SWAY (Inertial Spring Physics)
  const hatBrimY = headY - 20;
  const hatTipSway = Math.sin(cycle - 0.6) * 14; // Lags behind head motion!

  ctx.fillStyle = '#4B5563';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 3.0;

  // Hat brim (tilted ellipse)
  ctx.beginPath();
  ctx.ellipse(headX, hatBrimY, 36, 8, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hat cone with curved tip
  ctx.beginPath();
  ctx.moveTo(headX - 25, hatBrimY);
  ctx.bezierCurveTo(
    headX - 18, hatBrimY - 40,
    headX - 10 + hatTipSway * 0.5, hatBrimY - 60,
    headX + 4 + hatTipSway, hatBrimY - 80
  );
  ctx.bezierCurveTo(
    headX + 12 + hatTipSway * 0.8, hatBrimY - 60,
    headX + 22, hatBrimY - 35,
    headX + 25, hatBrimY
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Golden Hat Band
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(headX, hatBrimY - 4, 25, 5, -0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

async function renderVideo() {
  console.log(`Rendering 10-second comparison preview to ${OUTPUT_FILE}...`);

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${WIDTH}x${HEIGHT}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    OUTPUT_FILE
  ]);

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // Background: Minimalist warm cream with subtle studio grid
    ctx.fillStyle = '#FDFDFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Studio grid
    ctx.strokeStyle = 'rgba(76, 90, 105, 0.04)';
    ctx.lineWidth = 1.0;
    for (let gx = 0; gx < WIDTH; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, HEIGHT);
      ctx.stroke();
    }
    for (let gy = 0; gy < HEIGHT; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
    }

    if (t < 5.0) {
      // PART 1: SIDE-BY-SIDE DIRECT COMPARISON (0s - 5s)
      // Header
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STICKMAN EVOLUTION: CURRENT vs ADVANCED RIG', WIDTH / 2, 60);

      ctx.fillStyle = '#6B7280';
      ctx.font = '16px sans-serif';
      ctx.fillText('Testing Bang-Motion inspired Articulated Joint Physics, Facial Expressions & Dynamic Inertia', WIDTH / 2, 92);

      // Dividing line
      ctx.strokeStyle = 'rgba(209, 213, 219, 0.6)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 120);
      ctx.lineTo(WIDTH / 2, HEIGHT - 50);
      ctx.stroke();

      // LEFT SIDE: CURRENT BASIC STYLE
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('OLD / BASIC STYLE', WIDTH / 4, 150);

      ctx.fillStyle = '#4B5563';
      ctx.font = '15px sans-serif';
      ctx.fillText('• Rigid single-line limbs (no bending joints)', WIDTH / 4, 185);
      ctx.fillText('• Static eye dots (no blinking or gaze)', WIDTH / 4, 210);
      ctx.fillText('• Stiff cardboard clothing (no inertia)', WIDTH / 4, 235);
      ctx.fillText('• Flat linear motion (no ground shadow)', WIDTH / 4, 260);

      // Draw Old Stickman
      drawOldStickman(ctx, WIDTH / 4, 530, t);

      // RIGHT SIDE: ADVANCED REALISTIC RIG
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('ADVANCED BANG-MOTION RIG', (WIDTH * 3) / 4, 150);

      ctx.fillStyle = '#4B5563';
      ctx.font = '15px sans-serif';
      ctx.fillText('✓ 2-Bone Articulated Limbs (Organic Knees & Elbows)', (WIDTH * 3) / 4, 185);
      ctx.fillText('✓ Expressive Facial Rig (Blinks, Gaze, Mouth Sync)', (WIDTH * 3) / 4, 210);
      ctx.fillText('✓ Inertial Spring Physics (Flowing Scarf & Hat Tip)', (WIDTH * 3) / 4, 235);
      ctx.fillText('✓ Dynamic Soft Ambient Occlusion Shadow', (WIDTH * 3) / 4, 260);

      // Draw Advanced Stickman
      drawAdvancedStickman(ctx, (WIDTH * 3) / 4, 530, t, { isWalking: true, isTalking: false });

    } else {
      // PART 2: CINEMATIC CLOSE-UP DEMO (5s - 10s)
      const sceneTime = t - 5.0;

      // Camera push-in zoom simulation
      const zoom = 1.0 + (sceneTime * 0.04);
      ctx.save();
      ctx.translate(WIDTH / 2, HEIGHT / 2 + 50);
      ctx.scale(zoom, zoom);
      ctx.translate(-WIDTH / 2, -HEIGHT / 2 - 50);

      // Cinematic Header
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FULL HERO CLOSEUP: THE NEW MAGI RIG', WIDTH / 2, 70);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Fluid Secondary Motion + Gaze Tracking + Natural Gait', WIDTH / 2, 105);

      // Draw Advanced Magi in hero spotlight
      const isWalkingHero = sceneTime < 3.2;
      const isTalkingHero = sceneTime >= 3.2;
      const headTiltHero = sceneTime > 3.2 ? 0.12 : 0;

      // Position: walks in, then stops and speaks directly to viewer
      const heroX = isWalkingHero ? WIDTH / 2 - 80 + sceneTime * 25 : WIDTH / 2;
      drawAdvancedStickman(ctx, heroX, 540, t, {
        isWalking: isWalkingHero,
        isTalking: isTalkingHero,
        headTilt: headTiltHero
      });

      // Interactive Thought Bubble when he stops
      if (sceneTime >= 3.5) {
        const bubbleAlpha = Math.min(1, (sceneTime - 3.5) * 3);
        ctx.save();
        ctx.globalAlpha = bubbleAlpha;
        const bubbleX = heroX + 160;
        const bubbleY = 320;

        // Bubble shape
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E232A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(bubbleX - 130, bubbleY - 45, 260, 90, 16);
        ctx.fill();
        ctx.stroke();

        // Pointer
        ctx.beginPath();
        ctx.moveTo(bubbleX - 80, bubbleY + 45);
        ctx.lineTo(bubbleX - 105, bubbleY + 68);
        ctx.lineTo(bubbleX - 60, bubbleY + 45);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1E232A';
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('"This is how stickman', bubbleX, bubbleY - 10);
        ctx.fillText('should actually move!"', bubbleX, bubbleY + 16);
        ctx.restore();
      }

      ctx.restore();
    }

    // Render frame to ffmpeg
    const buffer = canvas.data();
    ffmpeg.stdin.write(buffer);
  }

  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  console.log(`✓ 10-second preview rendered successfully: ${OUTPUT_FILE}`);
}

renderVideo().catch(err => {
  console.error(err);
  process.exit(1);
});
