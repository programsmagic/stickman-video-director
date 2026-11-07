// EP06 art: inherits EP01-EP05 assets + lie/truth-specific characters & props
import fs from 'node:fs';
const ep01 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep01-see-salaries/build/art/${name}`, import.meta.url))).assets;
const ep02 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep02-see-karma/build/art/${name}`, import.meta.url))).assets;
const ep04 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep04-save-point/build/art/${name}`, import.meta.url))).assets;
const ep05 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep05-see-lifespan/build/art/${name}`, import.meta.url))).assets;

const MAGI = ['wizard-hat', 'glasses'];
const you = pose => ({figure: {scarf: true, ...pose, accessories: [...MAGI, ...(pose.accessories || [])]}});
const npc = (seed, pose) => ({seed, figure: {scarf: false, ...pose}});

const assets = {
  ...ep01('preview-art.json'),
  ...ep01('film-art.json'),
  ...ep02('art.json'),
  ...ep04('art.json'),
  ...ep05('art.json'),
  'roommate': npc(5001, {facing: 'left', torso: 5, armL: [-10, 10], armR: [30, 20], accessories: ['hair-messy'], brows: 'neutral', mouth: 'smile'}),
  'roommate-eating': npc(5002, {facing: 'left', torso: 10, armL: [-20, -10], armR: [45, 60], accessories: ['hair-messy'], brows: 'raised', mouth: 'open'}),
  'colleague-whisper': npc(5011, {facing: 'left', torso: 15, armL: [10, 30], armR: [60, 100], accessories: ['hair-long', 'glasses'], brows: 'raised', mouth: 'smile'}),
  'friend-vulnerable': npc(5021, {facing: 'right', torso: 4, armL: [-15, -5], armR: [20, 15], accessories: ['cap'], brows: 'sad', mouth: 'flat'}),
  'barista': npc(5031, {facing: 'right', armL: [-20, -10], armR: [35, 25], accessories: ['apron-red'], brows: 'raised', mouth: 'smile'}),
  'you-point': you({facing: 'right', torso: 5, armL: [-10, -5], armR: [100, 160], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'you-cry': you({facing: 'left', torso: -10, armL: [-20, -40], armR: [20, 40], eyes: 'closed', brows: 'sad', mouth: 'open'}),
  'you-smile': you({facing: 'right', armL: [-15, -10], armR: [15, 10], eyes: 'normal', brows: 'neutral', mouth: 'smile'}),
  'tag-lie': {prop: 'card', size: [280, 100]},
  'tag-truth': {prop: 'card', size: [280, 100]},
};

fs.writeFileSync(new URL('./art.json', import.meta.url), JSON.stringify({assets}, null, 1));
console.log(Object.keys(assets).length, 'assets');

