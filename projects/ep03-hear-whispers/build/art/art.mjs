// EP03 art: EP01 & EP02's cast and props plus whisper-specific assets -> art.json
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
  'you-shocked': you({armL: [-70, -100], armR: [70, 100], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'you-relieved': you({facing: 'right', armL: [-10, -5], armR: [30, 20], eyes: 'closed', brows: 'neutral', mouth: 'smile'}),
  'you-listen-close': you({facing: 'right', armL: [-10, -5], armR: [140, 190], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'roommate': npc(3001, {facing: 'left', armL: [-20, -5], armR: [30, 20], accessories: ['cap'], brows: 'raised', mouth: 'grin'}),
  'subway-rider': npc(3011, {armL: [-10, -5], armR: [120, 175], accessories: ['phone'], brows: 'neutral', mouth: 'flat'}),
  'door': {prop: 'building', size: [220, 440]},
  'speech-bubble': {prop: 'card', size: [240, 140]},
};

fs.writeFileSync(new URL('./art.json', import.meta.url), JSON.stringify({assets}, null, 1));
console.log(Object.keys(assets).length, 'assets');
