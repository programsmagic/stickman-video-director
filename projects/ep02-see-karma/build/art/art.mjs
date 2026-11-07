// EP02 art: EP01's cast and props plus the karma episode's new ones → art.json
import fs from 'node:fs';
const ep01 = name => JSON.parse(fs.readFileSync(new URL(`../../../ep01-see-salaries/build/art/${name}`, import.meta.url))).assets;
const SIT = {legL: [80, 2], legR: [86, 8]};
const MAGI = ['wizard-hat', 'glasses'];
const you = pose => ({figure: {scarf: true, ...pose, accessories: [...MAGI, ...(pose.accessories || [])]}});
const npc = (seed, pose) => ({seed, figure: {scarf: false, ...pose}});
const assets = {
  ...ep01('preview-art.json'), ...ep01('film-art.json'),
  'you-cape': you({armL: [-120, -60], armR: [120, 60], brows: 'raised', mouth: 'grin', accessories: ['cape']}),
  'you-give': you({facing: 'right', armL: [-12, -5], armR: [75, 85], accessories: ['coffee'], brows: 'raised', mouth: 'smile'}),
  'you-ear': you({facing: 'right', armL: [-12, -5], armR: [150, 200], eyes: 'wide', brows: 'raised', mouth: 'o'}),
  'you-phone': you({facing: 'right', armL: [-12, -5], armR: [120, 175], accessories: ['phone'], mouth: 'smile'}),
  'you-carry': you({facing: 'right', armL: [55, 80], armR: [65, 85], brows: 'raised', mouth: 'smile'}),
  'you-kind': you({facing: 'right', armL: [-12, -5], armR: [60, 30], brows: 'raised', mouth: 'smile'}),
  'shouter': npc(1001, {facing: 'right', torso: 8, armL: [-30, 60], armR: [120, 175], accessories: ['phone'], eyes: 'squint', brows: 'angry', mouth: 'open'}),
  'girl': npc(1011, {armL: [-20, -10], armR: [140, 175], accessories: ['hair-long'], mouth: 'grin'}),
  'mum-kid': npc(1021, {facing: 'right', armL: [-10, -5], armR: [40, 20], accessories: ['hair-long'], mouth: 'smile'}),
  'salesman': npc(1031, {facing: 'right', armL: [-10, -5], armR: [80, 100], accessories: ['apron-red'], brows: 'raised', mouth: 'grin'}),
  'oldman': npc(1041, {facing: 'left', torso: -10, head: -8, armL: [-40, -20], armR: [20, 5], accessories: ['glasses', 'mustache'], mouth: 'smile'}),
  'cold-woman': npc(1051, {torso: 4, armL: [-35, 50], armR: [35, -50], accessories: ['hair-long'], eyes: 'closed', brows: 'sad', mouth: 'wavy'}),
  'warm-woman': npc(1051, {facing: 'left', armL: [-70, -100], armR: [-60, -110], accessories: ['hair-long'], eyes: 'wide', brows: 'raised', mouth: 'grin'}),
  'door-woman': npc(1051, {facing: 'right', armL: [-10, -5], armR: [80, 85], accessories: ['hair-long'], mouth: 'smile'}),
  'crutch-man': npc(1061, {facing: 'right', armL: [-30, -10], armR: [30, 10], accessories: ['glasses'], mouth: 'smile'}),
  'baby-mum': npc(1071, {facing: 'left', armL: [-70, -100], armR: [-60, -100], accessories: ['bun'], brows: 'sad', mouth: 'smile'}),
  'cutter': npc(1081, {facing: 'right', torso: 10, armL: [-30, -10], armR: [70, 100], brows: 'angry', mouth: 'flat'}),
  'shover': npc(1091, {facing: 'right', torso: 12, armL: [70, 100], armR: [80, 95], eyes: 'squint', brows: 'angry', mouth: 'open'}),
  'filmer': npc(1101, {facing: 'right', armL: [-60, -100], armR: [120, 175], accessories: ['phone'], mouth: 'grin'}),
  'jobless': npc(1111, {facing: 'right', head: 10, armL: [60, 90], armR: [70, 95], brows: 'sad', mouth: 'frown'}),
  'whisper-a': npc(1121, {facing: 'right', armL: [-10, -5], armR: [120, 175], accessories: ['bun', 'glasses'], eyes: 'squint', mouth: 'flat'}),
  'whisper-b': npc(1131, {facing: 'left', head: -8, armL: [-10, -5], armR: [10, 5], accessories: ['hair-long'], eyes: 'squint', mouth: 'o'}),
  'officer': npc(1141, {facing: 'left', armL: [-70, -100], armR: [20, 5], accessories: ['uniform', 'cap'], brows: 'sad', mouth: 'flat'}),
  'officer-smile': npc(1141, {facing: 'left', armL: [-20, -5], armR: [20, 5], accessories: ['uniform', 'cap'], brows: 'raised', mouth: 'grin'}),
  'leo-phone': npc(401, {armL: [-10, -5], armR: [120, 175], accessories: ['phone'], brows: 'sad', mouth: 'wavy', marks: ['sweat']}),
  'kevin-grin': npc(101, {facing: 'left', armL: [-75, -90], armR: [10, 5], brows: 'raised', mouth: 'grin'}),
  kiosk: {prop: 'kiosk', size: [320, 280]}, can: {prop: 'can', size: [90, 150]},
  'tickets-1': {prop: 'tickets', size: [160, 200], n: 2, label: 'NO COKE'}, 'tickets-2': {prop: 'tickets', size: [160, 200], n: 5, label: 'GOT A COKE'},
  groceries: {prop: 'groceries', size: [130, 140]}, busstop: {prop: 'busstop', size: [440, 400]}, crutches: {prop: 'crutches', size: [120, 260]},
  baby: {prop: 'baby', size: [110, 90]}, 'scale-tip': {prop: 'scale', size: [320, 280], tilt: 0.2}, meter: {prop: 'meter', size: [110, 260]},
  officebox: {prop: 'officebox', size: [160, 130]}, 'msg-mum': {prop: 'phonemsg', size: [260, 330], label: 'Thank you, Mum.'},
  balloon: {prop: 'balloon', size: [80, 160]}, leaderboard: {prop: 'leaderboard', size: [320, 300]}, hotcocoa: {prop: 'hotcocoa', size: [90, 120]},
  'sign-500': {prop: 'sign', size: [260, 110], label: '+500 ONLY', color: '#EC4338'}, 'sign-hospital': {prop: 'sign', size: [300, 100], label: 'HOSPITAL', color: '#3D7DD8'},
  'sign-sample': {prop: 'sign', size: [200, 90], label: 'SAMPLES', color: '#2F8A4A'},
};
fs.writeFileSync(new URL('./art.json', import.meta.url), JSON.stringify({assets}, null, 1));
console.log(Object.keys(assets).length, 'assets');
