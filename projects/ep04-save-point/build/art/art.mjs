// EP04 art: EP01 & EP02's cast and props plus save-point specific assets -> art.json
import fs from 'node:fs';
const ep01 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep01-see-salaries/build/art/${name}`, import.meta.url))).assets;
const ep02 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep02-see-karma/build/art/${name}`, import.meta.url))).assets;

const MAGI = ['wizard-hat', 'glasses'];
const you = pose => ({figure: {scarf: true, ...pose, accessories: [...MAGI, ...(pose.accessories || [])]}});
const npc = (seed, pose) => ({seed, figure: {scarf: false, ...pose}});

const assets = {
  ...ep01('preview-art.json'),
  ...ep01('film-art.json'),
  ...ep02('art.json'),
  // Save-point specific poses and props
  'you-wrist-tap': you({armL: [45, 90], armR: [45, 90], brows: 'raised', mouth: 'o'}),
  'you-shocked': you({armL: [-70, -100], armR: [70, 100], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'you-relieved': you({facing: 'right', armL: [-10, -5], armR: [30, 20], eyes: 'closed', brows: 'neutral', mouth: 'smile'}),
  'you-diner': you({facing: 'right', armL: [50, 80], armR: [60, 90], brows: 'raised', mouth: 'smile'}),
  'cyclist': npc(2001, {facing: 'right', torso: 25, armL: [40, 60], armR: [50, 70], accessories: ['cap'], brows: 'angry', mouth: 'open'}),
  'driver-scared': npc(2011, {facing: 'left', armL: [-60, -90], armR: [60, 90], eyes: 'wide', brows: 'sad', mouth: 'open'}),
  'friend-cry': npc(2021, {facing: 'left', torso: 5, head: 5, armL: [-30, -10], armR: [20, 5], accessories: ['hair-long'], eyes: 'closed', brows: 'sad', mouth: 'wavy'}),
  'friend-confused': npc(2021, {facing: 'left', armL: [-10, -5], armR: [45, 20], accessories: ['hair-long'], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'friend-smile': npc(2021, {facing: 'left', armL: [-20, -5], armR: [30, 10], accessories: ['hair-long'], eyes: 'normal', brows: 'raised', mouth: 'smile'}),
  mug: {prop: 'can', size: [100, 120]},
  pizza: {prop: 'card', size: [140, 120]},
  bus: {prop: 'building', size: [420, 220]},
};

fs.writeFileSync(new URL('./art.json', import.meta.url), JSON.stringify({assets}, null, 1));
console.log(Object.keys(assets).length, 'assets');

