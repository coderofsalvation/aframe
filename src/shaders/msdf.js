import { registerShader } from '../core/shader.js';
import * as THREE from 'three';

var VERTEX_SHADER = [
  '#include <common>',
  '#include <fog_pars_vertex>',
  '#include <logdepthbuf_pars_vertex>',

  'out vec2 vUV;',

  'void main(void) {',
  '  vUV = uv;',
  '  #include <begin_vertex>',
  '  #include <project_vertex>',
  '  #include <logdepthbuf_vertex>',
  '  #include <fog_vertex>',
  '}'
].join('\n');

var FRAGMENT_SHADER = [
  '#include <common>',
  '#include <fog_pars_fragment>',
  '#include <logdepthbuf_pars_fragment>',

  'uniform bool negate;',
  'uniform float alphaTest;',
  'uniform float opacity;',
  'uniform sampler2D map;',
  'uniform vec3 color;',
  'in vec2 vUV;',

  'float median(float r, float g, float b) {',
  '  return max(min(r, g), min(max(r, g), b));',
  '}',

  // FIXME: Experimentally determined constants.
  '#define BIG_ENOUGH 0.001',
  '#define MODIFIED_ALPHATEST (0.02 * isBigEnough / BIG_ENOUGH)',

  'void main() {',
  '  vec3 sampleColor = texture(map, vUV).rgb;',
  '  if (negate) { sampleColor = 1.0 - sampleColor; }',

  '  float sigDist = median(sampleColor.r, sampleColor.g, sampleColor.b) - 0.5;',
  '  float alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);',
  '  float dscale = 0.353505;',
  '  vec2 duv = dscale * (dFdx(vUV) + dFdy(vUV));',
  '  float isBigEnough = max(abs(duv.x), abs(duv.y));',

  // When texel is too small, blend raw alpha value rather than supersampling.
  // FIXME: Experimentally determined constant.
  '  // Do modified alpha test.',
  '  if (isBigEnough > BIG_ENOUGH) {',
  '    float ratio = BIG_ENOUGH / isBigEnough;',
  '    alpha = ratio * alpha + (1.0 - ratio) * (sigDist + 0.5);',
  '  }',

  '  // Do modified alpha test.',
  '  if (alpha < alphaTest * MODIFIED_ALPHATEST) { discard; return; }',
  '  gl_FragColor = vec4(color.xyz, alpha * opacity);',

  '  #include <logdepthbuf_fragment>',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '  #include <fog_fragment>',
  '}'
].join('\n');

/**
 * Multi-channel signed distance field.
 * Used by text component.
 */
export var Shader = registerShader('msdf', {
  schema: {
    alphaTest: {type: 'number', is: 'uniform', default: 0.5},
    color: {type: 'color', is: 'uniform', default: 'white'},
    map: {type: 'map', is: 'uniform'},
    negate: {type: 'boolean', is: 'uniform', default: true},
    opacity: {type: 'number', is: 'uniform', default: 1.0}
  },

  vertexShader: VERTEX_SHADER,

  fragmentShader: FRAGMENT_SHADER,

  init: function () {
    this.uniforms = this.initUniforms();
    // When using the WebGPURenderer there is no UniformsLib or UniformsUtils.
    if (THREE.UniformsUtils) {
      this.uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        this.uniforms
      ]);
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      fog: true
    });
    return this.material;
  }
});
