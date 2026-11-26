import fs from 'node:fs';
const NM='/path/to/osrs-like-wp/MP/node_modules/three';
const THREE=await import(NM+'/build/three.module.js');const {GLTFLoader}=await import(NM+'/examples/jsm/loaders/GLTFLoader.js');
const x=fs.readFileSync('/tmp/scratch/mp3/out/rig2_q.glb');const g=await new Promise((r,j)=>new GLTFLoader().parse(x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength),'',r,j));
let sk;g.scene.traverse(o=>{if(o.isSkinnedMesh)sk=o});const n=sk.geometry.getAttribute('normal');
let worst=0;for(let i=0;i<n.count;i++){worst=Math.max(worst,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1))}
console.log('normal',n.array.constructor.name,'normalized',n.normalized,'getX denormalises: worst |len-1|',worst.toFixed(4),'| uv present:',!!sk.geometry.getAttribute('uv'),'| position',sk.geometry.getAttribute('position').array.constructor.name);
