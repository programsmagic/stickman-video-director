// EP05 art: EP01-EP04 assets plus lifespan-specific assets -> art.json
import fs from 'node:fs';
const ep01 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep01-see-salaries/build/art/${name}`, import.meta.url))).assets;
const ep02 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep02-see-karma/build/art/${name}`, import.meta.url))).assets;
const ep04 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep04-save-point/build/art/${name}`, import.meta.url))).assets;

const MAGI = ['wizard-hat', 'glasses'];
const you = pose => ({figure: {scarf: true, ...pose, accessories: [...MAGI, ...(pose.accessories || [])]}});
const npc = (seed, pose) => ({seed, figure: {scarf: false, ...pose}});

const assets = {
  ...ep01('preview-art.json'),
  ...ep01('film-art.json'),
  ...ep02('art.json'),
  ...ep04('art.json'),
  'you-listen-close': you({facing: 'right', armL: [-10, -5], armR: [140, 190], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'jogger': npc(4001, {facing: 'right', torso: 15, armL: [-60, -90], armR: [60, 90], accessories: ['cap'], brows: 'raised', mouth: 'open'}),
  'courier': npc(4011, {facing: 'left', torso: 8, armL: [40, 70], armR: [50, 80], accessories: ['cap'], brows: 'raised', mouth: 'smile'}),
  'student': npc(4021, {facing: 'right', torso: 6, armL: [-10, -5], armR: [45, 30], accessories: ['hair-long', 'glasses'], brows: 'neutral', mouth: 'flat'}),
  'mum-kitchen': npc(4031, {facing: 'right', armL: [-20, -5], armR: [30, 20], accessories: ['bun', 'apron-red'], brows: 'raised', mouth: 'smile'}),
  'dad-crossword': npc(4041, {facing: 'left', torso: -8, armL: [-30, -10], armR: [20, 5], accessories: ['glasses', 'mustache'], mouth: 'smile'}),
  'digital-clock': {prop: 'card', size: [280, 110]},
};

fs.writeFileSync(new URL('./art.json', import.meta.url), JSON.stringify({assets}, null, 1));
console.log(Object.keys(assets).length, 'assets');
