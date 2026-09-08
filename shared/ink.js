import * as THREE from '../vendor/three.module.min.js';
const BLUE=0x2a42ad, PAPER=0xf7f4e9;

// Original world-space pen shader. It shades geometry with crosshatching,
// keeping the strokes attached to the court as the camera moves.
export function penMaterial(color=BLUE,fill=0.07) {
  return new THREE.ShaderMaterial({
    uniforms:{ink:{value:new THREE.Color(color)},paper:{value:new THREE.Color(PAPER)},fill:{value:fill}},
    vertexShader:`varying vec3 wp; varying vec3 wn;
      void main(){vec4 w=modelMatrix*vec4(position,1.0);wp=w.xyz;wn=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform vec3 ink;uniform vec3 paper;uniform float fill;varying vec3 wp;varying vec3 wn;
      void main(){vec3 n=normalize(wn);float light=dot(n,normalize(vec3(-.4,.9,.6)))*.5+.5;
      vec2 p=abs(n.y)>.55?wp.xz:(abs(n.x)>.55?wp.zy:wp.xy);
      float h1=1.-smoothstep(.035,.12,abs(fract((p.x+p.y)*11.)-.5));
      float h2=1.-smoothstep(.035,.11,abs(fract((p.x-p.y)*13.)-.5));
      float hatch=h1*(1.-smoothstep(.4,.77,light))+h2*(1.-smoothstep(.14,.36,light))*.5;
      float amount=clamp(fill+(1.-light)*.06+hatch*.3,0.,.86);
      gl_FragColor=vec4(mix(paper,ink,amount),1.);
      #include <colorspace_fragment>
      }`
  });
}

// Transparent water, glass, shadows and markers remain lightweight overlays.
export function inkSurface(color, opacity = 1) {
  if (opacity < .7) return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const material = penMaterial(color, color === PAPER ? .015 : .32);
  material.side = THREE.DoubleSide;
  return material;
}
export function outlineMeshes(group, color = BLUE) {
  const meshes = [];
  group.traverse(object => { if (object.isMesh && object.material.isShaderMaterial) meshes.push(object); });
  for (const mesh of meshes) {
    const shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
    shell.scale.setScalar(1.045); mesh.add(shell);
  }
}
