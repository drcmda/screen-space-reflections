function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "set"); _classApplyDescriptorSet(receiver, descriptor, value); return value; }

function _classApplyDescriptorSet(receiver, descriptor, value) { if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } }

function _classPrivateMethodInitSpec(obj, privateSet) { _checkPrivateRedeclaration(obj, privateSet); privateSet.add(obj); }

function _classPrivateFieldInitSpec(obj, privateMap, value) { _checkPrivateRedeclaration(obj, privateMap); privateMap.set(obj, value); }

function _checkPrivateRedeclaration(obj, privateCollection) { if (privateCollection.has(obj)) { throw new TypeError("Cannot initialize the same private elements twice on an object"); } }

function _classPrivateMethodGet(receiver, privateSet, fn) { if (!privateSet.has(receiver)) { throw new TypeError("attempted to get private field on non-instance"); } return fn; }

function _classPrivateFieldGet(receiver, privateMap) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "get"); return _classApplyDescriptorGet(receiver, descriptor); }

function _classExtractFieldDescriptor(receiver, privateMap, action) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to " + action + " private field on non-instance"); } return privateMap.get(receiver); }

function _classApplyDescriptorGet(receiver, descriptor) { if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

import { Pass, RenderPass, DepthPass, KernelSize, KawaseBlurPass } from 'postprocessing';
import { WebGLRenderTarget, NearestFilter, ShaderMaterial, Uniform, ShaderChunk, Matrix4, HalfFloatType, UniformsUtils, FrontSide, Vector2, Matrix3, TangentSpaceNormalMap, GLSL3, WebGLMultipleRenderTargets, NearestMipmapNearestFilter, FramebufferTexture, RGBAFormat, LinearFilter } from 'three';
import WEBGL from 'three/examples/jsm/capabilities/WebGL.js';
var vertexShader = "#define GLSLIFY 1\nvarying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}"; // eslint-disable-line

class ComposeReflectionsPass extends Pass {
  constructor(scene, camera) {
    super("ReflectionsPass");
    this._scene = scene;
    this._camera = camera;
    this.renderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: NearestFilter,
      magFilter: NearestFilter
    });
    this.fullscreenMaterial = new ShaderMaterial({
      type: "ComposeReflectionsMaterial",
      uniforms: {
        inputBuffer: new Uniform(null),
        lastFrameReflectionsBuffer: new Uniform(null),
        velocityBuffer: new Uniform(null),
        samples: new Uniform(null)
      },
      vertexShader,
      fragmentShader:
      /* glsl */
      `
				#define EULER 2.718281828459045

                uniform sampler2D inputBuffer;
                uniform sampler2D lastFrameReflectionsBuffer;
				uniform sampler2D velocityBuffer;

				uniform float samples;

                varying vec2 vUv;

                void main() {
                    vec4 inputTexel = texture2D(inputBuffer, vUv);
                    vec4 lastFrameReflectionsTexel = texture2D(lastFrameReflectionsBuffer, vUv);

					#ifdef TEMPORAL_RESOLVE
						vec2 velUv = texture2D(velocityBuffer, vUv).xy;
						vec4 lastFrameReflectionsProjectedTexel = texture2D(lastFrameReflectionsBuffer, vUv - velUv);
						lastFrameReflectionsTexel.rgb += lastFrameReflectionsProjectedTexel.rgb;
						lastFrameReflectionsTexel.rgb /= 2.;

						float mixVal = 1. / samples;
						mixVal /= EULER;

						vec3 newColor = mix(lastFrameReflectionsTexel.rgb, inputTexel.rgb, mixVal);

						// alternative sampling option - not using it as ther's much more noise when moving camera
						// newColor = lastFrameReflectionsTexel.rgb * (1. - 1. / samples) + inputTexel.rgb / samples;

						if(length(lastFrameReflectionsTexel.rgb) < 0.001){
							newColor = mix(lastFrameReflectionsTexel.rgb, lastFrameReflectionsTexel.rgb + inputTexel.rgb, 0.25);
						}

						float blurMix = mix(lastFrameReflectionsTexel.a, inputTexel.a + 0.5, mixVal);
						gl_FragColor = vec4(newColor, blurMix);	
					#else
						gl_FragColor = vec4(inputTexel.rgb, inputTexel.a);
					#endif
                }
            `
    });
  }

  render(renderer, inputBuffer) {
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.scene, this.camera);
  }

}

var fragmentShader$1 = "#define GLSLIFY 1\n#define MODE_DEFAULT 0\n#define MODE_REFLECTIONS 1\n#define MODE_RAW_REFLECTION 2\n#define MODE_BLURRED_REFLECTIONS 3\n#define MODE_INPUT 4\n#define MODE_BLUR_MIX 5\n#define FLOAT_EPSILON 0.00001\n#define SQRT_3 1.7320508075688772 + FLOAT_EPSILON\nuniform sampler2D inputBuffer;uniform sampler2D reflectionsBuffer;uniform sampler2D blurredReflectionsBuffer;uniform float samples;varying vec2 vUv;void main(){vec4 inputTexel=texture2D(inputBuffer,vUv);vec4 reflectionsTexel=texture2D(reflectionsBuffer,vUv);vec3 reflectionClr=reflectionsTexel.xyz*1.;float blurMix=0.;\n#ifdef USE_BLUR\nvec4 blurredReflectionsTexel=texture2D(blurredReflectionsBuffer,vUv);blurMix=reflectionsTexel.a;reflectionClr=mix(reflectionClr,blurredReflectionsTexel.xyz,blurMix);reflectionClr=mix(reflectionClr,vec3(0.),0.35*pow(SQRT_3-length(reflectionClr),1.5));reflectionClr=max(vec3(0.),reflectionClr);\n#endif\n#if RENDER_MODE == MODE_DEFAULT\ngl_FragColor=vec4(inputTexel.rgb+reflectionClr,1.);\n#endif\n#if RENDER_MODE == MODE_REFLECTIONS\ngl_FragColor=vec4(reflectionClr,1.);\n#endif\n#if RENDER_MODE == MODE_RAW_REFLECTION\ngl_FragColor=vec4(reflectionsTexel.xyz,1.);\n#endif\n#if RENDER_MODE == MODE_BLURRED_REFLECTIONS\n#ifdef USE_BLUR\ngl_FragColor=vec4(blurredReflectionsTexel.xyz,1.);\n#endif\n#endif\n#if RENDER_MODE == MODE_INPUT\ngl_FragColor=vec4(inputTexel.xyz,1.);\n#endif\n#if RENDER_MODE == MODE_BLUR_MIX\n#ifdef USE_BLUR\ngl_FragColor=vec4(vec3(blurMix),1.);\n#endif\n#endif\n#include <encodings_fragment>\n}"; // eslint-disable-line

class SSRCompositeMaterial extends ShaderMaterial {
  constructor() {
    super({
      type: "SSRCompositeMaterial",
      uniforms: {
        inputBuffer: new Uniform(null),
        reflectionsBuffer: new Uniform(null),
        blurredReflectionsBuffer: new Uniform(null),
        blurredReflectionsBuffer4: new Uniform(null),
        samples: new Uniform(1)
      },
      defines: {
        RENDER_MODE: 0
      },
      fragmentShader: fragmentShader$1,
      vertexShader:
      /* glsl */
      `
                varying vec2 vUv;

                void main() {
                    vUv = position.xy * 0.5 + 0.5;
                    gl_Position = vec4(position.xy, 1.0, 1.0);
                }
            `
    });
  }

} // Modified ShaderChunk.skinning_pars_vertex to handle
// a second set of bone information from the previou frame


const prev_skinning_pars_vertex = `
		#ifdef USE_SKINNING
		#ifdef BONE_TEXTURE
			uniform sampler2D prevBoneTexture;
			mat4 getPrevBoneMatrix( const in float i ) {
				float j = i * 4.0;
				float x = mod( j, float( boneTextureSize ) );
				float y = floor( j / float( boneTextureSize ) );
				float dx = 1.0 / float( boneTextureSize );
				float dy = 1.0 / float( boneTextureSize );
				y = dy * ( y + 0.5 );
				vec4 v1 = texture2D( prevBoneTexture, vec2( dx * ( x + 0.5 ), y ) );
				vec4 v2 = texture2D( prevBoneTexture, vec2( dx * ( x + 1.5 ), y ) );
				vec4 v3 = texture2D( prevBoneTexture, vec2( dx * ( x + 2.5 ), y ) );
				vec4 v4 = texture2D( prevBoneTexture, vec2( dx * ( x + 3.5 ), y ) );
				mat4 bone = mat4( v1, v2, v3, v4 );
				return bone;
			}
		#else
			uniform mat4 prevBoneMatrices[ MAX_BONES ];
			mat4 getPrevBoneMatrix( const in float i ) {
				mat4 bone = prevBoneMatrices[ int(i) ];
				return bone;
			}
		#endif
		#endif
	`; // Returns the body of the vertex shader for the velocity buffer and
// outputs the position of the current and last frame positions

const velocity_vertex = `
		vec3 transformed;

		// Get the normal
		${ShaderChunk.skinbase_vertex}
		${ShaderChunk.beginnormal_vertex}
		${ShaderChunk.skinnormal_vertex}
		${ShaderChunk.defaultnormal_vertex}

		// Get the current vertex position
		transformed = vec3( position );
		${ShaderChunk.skinning_vertex}
		newPosition = modelViewMatrix * vec4( transformed, 1.0 );

		// Get the previous vertex position
		transformed = vec3( position );
		${ShaderChunk.skinbase_vertex.replace(/mat4 /g, "").replace(/getBoneMatrix/g, "getPrevBoneMatrix")}
		${ShaderChunk.skinning_vertex.replace(/vec4 /g, "")}
		prevPosition = prevModelViewMatrix * vec4( transformed, 1.0 );

		newPosition =  projectionMatrix * newPosition;
		prevPosition = prevProjectionMatrix * prevPosition;

		gl_Position = mix( newPosition, prevPosition, interpolateGeometry );

	`;
const VelocityShader = {
  uniforms: {
    prevProjectionMatrix: {
      value: new Matrix4()
    },
    prevModelViewMatrix: {
      value: new Matrix4()
    },
    prevBoneTexture: {
      value: null
    },
    interpolateGeometry: {
      value: 0
    },
    intensity: {
      value: 1
    },
    alphaTest: {
      value: 0.0
    },
    map: {
      value: null
    },
    alphaMap: {
      value: null
    },
    opacity: {
      value: 1.0
    }
  },
  vertexShader: `
			${ShaderChunk.skinning_pars_vertex}
			${prev_skinning_pars_vertex}

			uniform mat4 prevProjectionMatrix;
			uniform mat4 prevModelViewMatrix;
			uniform float interpolateGeometry;
			varying vec4 prevPosition;
			varying vec4 newPosition;

			void main() {

				${velocity_vertex}

			}
		`,
  fragmentShader: `
			uniform float intensity;
			varying vec4 prevPosition;
			varying vec4 newPosition;

			void main() {

				vec3 pos0 = prevPosition.xyz / prevPosition.w;
				pos0 += 1.0;
				pos0 /= 2.0;

				vec3 pos1 = newPosition.xyz / newPosition.w;
				pos1 += 1.0;
				pos1 /= 2.0;

				vec3 vel = pos1 - pos0;
				gl_FragColor = vec4( vel * intensity, 1.0 );

			}
		`
};

var _defaultMaterials = /*#__PURE__*/new WeakMap();

var _velocityMaterials = /*#__PURE__*/new WeakMap();

var _prevModelViewMatrix = /*#__PURE__*/new WeakMap();

var _prevProjectionMatrix = /*#__PURE__*/new WeakMap();

var _prevViewMatrix = /*#__PURE__*/new WeakMap();

var _setVelocityMaterialInScene = /*#__PURE__*/new WeakSet();

var _unsetVelocityMaterialInScene = /*#__PURE__*/new WeakSet();

class VelocityPass extends Pass {
  constructor(scene, camera) {
    super("VelocityPass");

    _classPrivateMethodInitSpec(this, _unsetVelocityMaterialInScene);

    _classPrivateMethodInitSpec(this, _setVelocityMaterialInScene);

    _classPrivateFieldInitSpec(this, _defaultMaterials, {
      writable: true,
      value: {}
    });

    _classPrivateFieldInitSpec(this, _velocityMaterials, {
      writable: true,
      value: {}
    });

    _classPrivateFieldInitSpec(this, _prevModelViewMatrix, {
      writable: true,
      value: new Matrix4()
    });

    _classPrivateFieldInitSpec(this, _prevProjectionMatrix, {
      writable: true,
      value: new Matrix4()
    });

    _classPrivateFieldInitSpec(this, _prevViewMatrix, {
      writable: true,
      value: new Matrix4()
    });

    this._scene = scene;
    this._camera = camera;
    this.renderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      type: HalfFloatType
    });
  }

  render(renderer, inputBuffer) {
    _classPrivateMethodGet(this, _setVelocityMaterialInScene, _setVelocityMaterialInScene2).call(this);

    renderer.setRenderTarget(this.renderTarget);
    renderer.clear();
    renderer.render(this._scene, this._camera);

    _classPrivateMethodGet(this, _unsetVelocityMaterialInScene, _unsetVelocityMaterialInScene2).call(this);

    _classPrivateFieldGet(this, _prevViewMatrix).copy(this._camera.matrixWorldInverse);

    _classPrivateFieldGet(this, _prevProjectionMatrix).copy(this._camera.projectionMatrix);
  }

} // WebGL1: will render normals to RGB channel and roughness to A channel
// WebGL2: will render normals to RGB channel of "gNormal" buffer, roughness to A channel of "gNormal" buffer, depth to RGBA channel of "gDepth" buffer


function _setVelocityMaterialInScene2() {
  this._scene.traverse(c => {
    if (c.material) {
      const origMat = c.material;
      _classPrivateFieldGet(this, _defaultMaterials)[c.material.uuid] = origMat;

      if (_classPrivateFieldGet(this, _velocityMaterials)[origMat.uuid] === undefined) {
        _classPrivateFieldGet(this, _velocityMaterials)[origMat.uuid] = new ShaderMaterial({
          uniforms: UniformsUtils.clone(VelocityShader.uniforms),
          vertexShader: VelocityShader.vertexShader,
          fragmentShader: VelocityShader.fragmentShader,
          side: FrontSide
        });

        const velocityMaterial = _classPrivateFieldGet(this, _velocityMaterials)[origMat.uuid];

        velocityMaterial._originalUuid = c.material.uuid;
        velocityMaterial.extensions.derivatives = true;
      }

      const velocityMaterial = _classPrivateFieldGet(this, _velocityMaterials)[c.material.uuid];

      velocityMaterial.uniforms.prevModelViewMatrix.value.multiplyMatrices(_classPrivateFieldGet(this, _prevViewMatrix), c.matrixWorld);
      velocityMaterial.uniforms.prevProjectionMatrix.value = _classPrivateFieldGet(this, _prevProjectionMatrix);

      if (c.userData.matrixWorldPrevious) {
        velocityMaterial.uniforms.prevModelViewMatrix.value.copy(c.userData.prevModelViewMatrix);
      }

      c.material = velocityMaterial;
    }
  });
}

function _unsetVelocityMaterialInScene2() {
  this._scene.traverse(c => {
    if (c.material) {
      if (c.userData.prevModelViewMatrix === undefined) c.userData.prevModelViewMatrix = new Matrix4();
      c.userData.prevModelViewMatrix.multiplyMatrices(_classPrivateFieldGet(this, _prevViewMatrix), c.matrixWorld);
      c.material = _classPrivateFieldGet(this, _defaultMaterials)[c.material._originalUuid];
    }
  });
}

class NormalDepthRoughnessMaterial extends ShaderMaterial {
  constructor() {
    super({
      type: "NormalDepthRoughnessMaterial",
      defines: {
        USE_UV: ""
      },
      uniforms: {
        opacity: new Uniform(1),
        normalMap: new Uniform(null),
        normalScale: new Uniform(new Vector2(1, 1)),
        uvTransform: new Uniform(new Matrix3()),
        roughness: new Uniform(1),
        roughnessMap: new Uniform(null)
      },
      vertexShader:
      /* glsl */
      `
                #ifdef USE_MRT
                out vec2 vHighPrecisionZW;
                #endif

                #define NORMAL
                #if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
                    varying vec3 vViewPosition;
                #endif
                #include <common>
                #include <uv_pars_vertex>
                #include <displacementmap_pars_vertex>
                #include <normal_pars_vertex>
                #include <morphtarget_pars_vertex>
                #include <skinning_pars_vertex>
                #include <logdepthbuf_pars_vertex>
                #include <clipping_planes_pars_vertex>

                void main() {
                    #include <uv_vertex>
                    #include <beginnormal_vertex>
                    #include <morphnormal_vertex>
                    #include <skinbase_vertex>
                    #include <skinnormal_vertex>
                    #include <defaultnormal_vertex>
                    #include <normal_vertex>
                    #include <begin_vertex>
                    #include <morphtarget_vertex>
                    #include <skinning_vertex>
                    #include <displacementmap_vertex>
                    #include <project_vertex>
                    #include <logdepthbuf_vertex>
                    #include <clipping_planes_vertex>
                    #if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
                        vViewPosition = - mvPosition.xyz;
                    #endif

                    #ifdef USE_MRT
                        vHighPrecisionZW = gl_Position.zw;
                    #endif 

                    #ifdef USE_UV
                        vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
                    #endif

                }
            `,
      fragmentShader:
      /* glsl */
      `
                #define NORMAL
                #if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
                    varying vec3 vViewPosition;
                #endif
                #include <packing>
                #include <uv_pars_fragment>
                #include <normal_pars_fragment>
                #include <bumpmap_pars_fragment>
                #include <normalmap_pars_fragment>
                #include <logdepthbuf_pars_fragment>
                #include <clipping_planes_pars_fragment>

                #include <roughnessmap_pars_fragment>

                
                #ifdef USE_MRT
                layout(location = 0) out vec4 gNormal;
                layout(location = 1) out vec4 gDepth;
                
                in vec2 vHighPrecisionZW;
                #endif

                uniform float roughness;

                void main() {
                    #include <clipping_planes_fragment>
                    #include <logdepthbuf_fragment>
                    #include <normal_fragment_begin>
                    #include <normal_fragment_maps>
                    #include <roughnessmap_fragment>

                    vec3 normalColor = packNormalToRGB( normal );
                    float roughnessValue = min(1., roughnessFactor);

                    #ifdef USE_MRT
                        float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
                        vec4 depthColor = packDepthToRGBA( fragCoordZ );
                        gNormal = vec4( normalColor, 1.0 );
                        gNormal.a = roughnessValue;
                        gDepth = depthColor;
                    #else
                        gl_FragColor = vec4(normalColor, roughnessValue);
                    #endif

                }
            `,
      toneMapped: false
    });
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    Object.defineProperty(this, "glslVersion", {
      get() {
        return "USE_MRT" in this.defines ? GLSL3 : null;
      },

      set(_) {}

    });
  }

}

var helperFunctions = "#define GLSLIFY 1\nvec3 getViewPosition(const float depth){float clipW=_projectionMatrix[2][3]*depth+_projectionMatrix[3][3];vec4 clipPosition=vec4((vec3(vUv,depth)-0.5)*2.0,1.0);clipPosition*=clipW;return(_inverseProjectionMatrix*clipPosition).xyz;}float getViewZ(const float depth){return perspectiveDepthToViewZ(depth,cameraNear,cameraFar);}vec3 screenSpaceToWorldSpace(const vec2 uv,const float depth){vec4 ndc=vec4((uv.x-0.5)*2.0,(uv.y-0.5)*2.0,(depth-0.5)*2.0,1.0);vec4 clip=_inverseProjectionMatrix*ndc;vec4 view=cameraMatrixWorld*(clip/clip.w);return view.xyz;}\n#define Scale (vec3(0.8, 0.8, 0.8))\n#define K (19.19)\nvec3 hash(vec3 a){a=fract(a*Scale);a+=dot(a,a.yxz+K);return fract((a.xxy+a.yxx)*a.zyx);}float fresnel_dielectric_cos(float cosi,float eta){float c=abs(cosi);float g=eta*eta-1.0+c*c;float result;if(g>0.0){g=sqrt(g);float A=(g-c)/(g+c);float B=(c*(g+c)-1.0)/(c*(g-c)+1.0);result=0.5*A*A*(1.0+B*B);}else{result=1.0;}return result;}float fresnel_dielectric(vec3 Incoming,vec3 Normal,float eta){float cosine=dot(Incoming,Normal);return min(1.0,5.0*fresnel_dielectric_cos(cosine,eta));}"; // eslint-disable-line

var fragmentShader = "#define GLSLIFY 1\nvarying vec2 vUv;uniform sampler2D inputBuffer;uniform sampler2D lastFrameReflectionsBuffer;uniform sampler2D normalBuffer;uniform sampler2D depthBuffer;uniform mat4 _projectionMatrix;uniform mat4 _inverseProjectionMatrix;uniform mat4 cameraMatrixWorld;uniform float cameraNear;uniform float cameraFar;uniform float rayStep;uniform float intensity;uniform float maxDepthDifference;uniform float roughnessFadeOut;uniform float depthBlur;uniform float maxBlur;uniform float maxDepth;uniform float rayFadeOut;uniform float thickness;uniform float ior;uniform float samples;\n#ifdef USE_JITTERING\nuniform float jitter;uniform float jitterRough;uniform float jitterSpread;\n#endif\n#define FLOAT_EPSILON 0.00001\n#define EARLY_OUT_COLOR vec4(0., 0., 0., 1.)\nconst vec2 INVALID_RAY_COORDS=vec2(-1.);float _maxDepthDifference;\n#include <packing>\n#include <helperFunctions>\nvec2 BinarySearch(inout vec3 dir,inout vec3 hitPos,inout float rayHitDepthDifference);vec2 RayMarch(vec3 dir,inout vec3 hitPos,inout float rayHitDepthDifference);void main(){vec4 depthTexel=texture2D(depthBuffer,vUv);if(dot(depthTexel.rgb,depthTexel.rgb)<FLOAT_EPSILON){gl_FragColor=EARLY_OUT_COLOR;return;}float unpackedDepth=unpackRGBAToDepth(depthTexel);if(unpackedDepth>maxDepth){gl_FragColor=EARLY_OUT_COLOR;return;}vec4 normalTexel=texture2D(normalBuffer,vUv);float roughness=normalTexel.a;if(roughness>1.-FLOAT_EPSILON&&roughnessFadeOut>1.-FLOAT_EPSILON){gl_FragColor=EARLY_OUT_COLOR;return;}float specular=1.-roughness;specular*=specular;normalTexel.rgb=unpackRGBToNormal(normalTexel.rgb);float depth=getViewZ(unpackedDepth);vec3 viewNormal=normalTexel.xyz;vec3 viewPos=getViewPosition(depth);vec3 worldPos=screenSpaceToWorldSpace(vUv,unpackedDepth);vec3 reflected=normalize(reflect(normalize(viewPos),normalize(viewNormal)));if(viewNormal.z-reflected.z<0.005){gl_FragColor=EARLY_OUT_COLOR;return;}_maxDepthDifference=maxDepthDifference*0.01;vec3 jitt=vec3(0.);\n#ifdef USE_JITTERING\nvec3 randomJitter=hash(5.*(samples*worldPos))-vec3(0.5,0.5,0.5);float spread=((2.-specular)+0.05*roughness*jitterRough)*jitterSpread;float jitterMix=jitter+jitterRough*roughness;if(jitterMix>1.)jitterMix=1.;jitt=mix(vec3(0.),randomJitter*spread,jitterMix);\n#endif\nvec3 hitPos=viewPos;float rayHitDepthDifference;vec2 coords=RayMarch(jitt+reflected*-viewPos.z,hitPos,rayHitDepthDifference);if(coords.x==-1.){gl_FragColor=EARLY_OUT_COLOR;return;}vec2 coordsNDC=(coords*2.0-1.0);float screenFade=0.1;float maxDimension=min(1.0,max(abs(coordsNDC.x),abs(coordsNDC.y)));float screenEdgefactor=1.0-(max(0.0,maxDimension-screenFade)/(1.0-screenFade));screenEdgefactor=max(0.,screenEdgefactor);vec3 SSR=texture2D(inputBuffer,coords.xy).rgb;float roughnessFactor=mix(specular,1.,max(0.,1.-roughnessFadeOut));vec3 finalSSR=SSR*screenEdgefactor*roughnessFactor;vec3 hitWorldPos=screenSpaceToWorldSpace(coords,rayHitDepthDifference);float reflectionDistance=distance(hitWorldPos,worldPos);reflectionDistance+=1.;if(rayFadeOut!=0.){float opacity=1./(reflectionDistance*reflectionDistance*rayFadeOut*0.01);if(opacity>1.)opacity=1.;finalSSR*=opacity;}float blurMix=0.;\n#ifdef USE_BLUR\nblurMix=sqrt(reflectionDistance)*depthBlur;if(blurMix>1.)blurMix=1.;\n#endif\nblurMix=min(blurMix,maxBlur);float fresnelFactor=fresnel_dielectric(normalize(viewPos),viewNormal,ior);finalSSR=finalSSR*fresnelFactor*intensity;finalSSR=min(vec3(1.),finalSSR);gl_FragColor=vec4(finalSSR,blurMix);\n#include <encodings_fragment>\n}vec2 RayMarch(vec3 dir,inout vec3 hitPos,inout float rayHitDepthDifference){dir=normalize(dir);dir*=rayStep;float depth;int steps;vec4 projectedCoord;vec4 lastProjectedCoord;float unpackedDepth;float stepMultiplier=1.;vec4 depthTexel;for(int i=0;i<MAX_STEPS;i++){hitPos+=dir*stepMultiplier;projectedCoord=_projectionMatrix*vec4(hitPos,1.0);projectedCoord.xy/=projectedCoord.w;projectedCoord.xy=projectedCoord.xy*0.5+0.5;if(projectedCoord.x>1.||projectedCoord.y>1.){hitPos-=dir*stepMultiplier;stepMultiplier*=0.5;continue;}depthTexel=textureLod(depthBuffer,projectedCoord.xy,0.);unpackedDepth=unpackRGBAToDepth(depthTexel);depth=getViewZ(unpackedDepth);rayHitDepthDifference=depth-hitPos.z;if(rayHitDepthDifference>=0.){if(rayHitDepthDifference>thickness)return INVALID_RAY_COORDS;\n#if NUM_BINARY_SEARCH_STEPS == 0\nif(dot(depthTexel.rgb,depthTexel.rgb)<FLOAT_EPSILON)return INVALID_RAY_COORDS;\n#else\nprojectedCoord.xy=BinarySearch(dir,hitPos,rayHitDepthDifference);\n#endif\nreturn projectedCoord.xy;}steps++;lastProjectedCoord=projectedCoord;}\n#ifndef STRETCH_MISSED_RAYS\nreturn INVALID_RAY_COORDS;\n#endif\nrayHitDepthDifference=unpackedDepth;return projectedCoord.xy;}vec2 BinarySearch(inout vec3 dir,inout vec3 hitPos,inout float rayHitDepthDifference){float depth;vec4 projectedCoord;vec2 lastMinProjectedCoordXY;float unpackedDepth;vec4 depthTexel;for(int i=0;i<NUM_BINARY_SEARCH_STEPS;i++){projectedCoord=_projectionMatrix*vec4(hitPos,1.0);projectedCoord.xy/=projectedCoord.w;projectedCoord.xy=projectedCoord.xy*0.5+0.5;if((lastMinProjectedCoordXY.x>1.||lastMinProjectedCoordXY.y>1.)&&(projectedCoord.x>1.||projectedCoord.y>1.))return INVALID_RAY_COORDS;depthTexel=textureLod(depthBuffer,projectedCoord.xy,0.);unpackedDepth=unpackRGBAToDepth(depthTexel);depth=getViewZ(unpackedDepth);rayHitDepthDifference=depth-hitPos.z;dir*=0.5;if(rayHitDepthDifference>0.0){hitPos-=dir;}else{hitPos+=dir;lastMinProjectedCoordXY=projectedCoord.xy;}}if(dot(depthTexel.rgb,depthTexel.rgb)<FLOAT_EPSILON)return INVALID_RAY_COORDS;if(abs(rayHitDepthDifference)>_maxDepthDifference)return INVALID_RAY_COORDS;projectedCoord=_projectionMatrix*vec4(hitPos,1.0);projectedCoord.xy/=projectedCoord.w;projectedCoord.xy=projectedCoord.xy*0.5+0.5;\n#ifndef STRETCH_MISSED_RAYS\nif(projectedCoord.x>1.||projectedCoord.y>1.)return INVALID_RAY_COORDS;\n#endif\nrayHitDepthDifference=unpackedDepth;return projectedCoord.xy;}"; // eslint-disable-line

class SSRMaterial extends ShaderMaterial {
  constructor() {
    super({
      type: "SSRMaterial",
      uniforms: {
        inputBuffer: new Uniform(null),
        lastFrameReflectionsBuffer: new Uniform(null),
        normalBuffer: new Uniform(null),
        depthBuffer: new Uniform(null),
        _projectionMatrix: new Uniform(new Matrix4()),
        _inverseProjectionMatrix: new Uniform(new Matrix4()),
        cameraMatrixWorld: new Uniform(new Matrix4()),
        cameraNear: new Uniform(0),
        cameraFar: new Uniform(0),
        rayStep: new Uniform(0.1),
        intensity: new Uniform(1),
        roughnessFadeOut: new Uniform(1),
        rayFadeOut: new Uniform(0),
        thickness: new Uniform(10),
        ior: new Uniform(1.45),
        maxDepthDifference: new Uniform(1),
        maxDepth: new Uniform(1),
        jitter: new Uniform(0.5),
        jitterRough: new Uniform(0.5),
        jitterSpread: new Uniform(1),
        depthBlur: new Uniform(1),
        maxBlur: new Uniform(1),
        samples: new Uniform(0)
      },
      defines: {
        MAX_STEPS: 20,
        NUM_BINARY_SEARCH_STEPS: 5
      },
      fragmentShader: fragmentShader.replace("#include <helperFunctions>", helperFunctions),
      vertexShader,
      toneMapped: false,
      depthWrite: false,
      depthTest: false
    });
  }

}

var _defaultMaterials2 = /*#__PURE__*/new WeakMap();

var _normalDepthMaterials = /*#__PURE__*/new WeakMap();

var _options = /*#__PURE__*/new WeakMap();

var _useMRT = /*#__PURE__*/new WeakMap();

var _webgl1DepthPass = /*#__PURE__*/new WeakMap();

var _setNormalDepthRoughnessMaterialInScene = /*#__PURE__*/new WeakSet();

var _unsetNormalDepthRoughnessMaterialInScene = /*#__PURE__*/new WeakSet();

class ReflectionsPass extends Pass {
  constructor(scene, camera, options = {}) {
    super("ReflectionsPass");

    _classPrivateMethodInitSpec(this, _unsetNormalDepthRoughnessMaterialInScene);

    _classPrivateMethodInitSpec(this, _setNormalDepthRoughnessMaterialInScene);

    _classPrivateFieldInitSpec(this, _defaultMaterials2, {
      writable: true,
      value: {}
    });

    _classPrivateFieldInitSpec(this, _normalDepthMaterials, {
      writable: true,
      value: {}
    });

    _classPrivateFieldInitSpec(this, _options, {
      writable: true,
      value: {}
    });

    _classPrivateFieldInitSpec(this, _useMRT, {
      writable: true,
      value: false
    });

    _classPrivateFieldInitSpec(this, _webgl1DepthPass, {
      writable: true,
      value: null
    });

    _defineProperty(this, "staticNoise", false);

    this._scene = scene;
    this._camera = camera;

    _classPrivateFieldSet(this, _options, options);

    this.fullscreenMaterial = new SSRMaterial();

    for (const key of Object.keys(options)) {
      if (this.fullscreenMaterial.uniforms[key] !== undefined) {
        this.fullscreenMaterial.uniforms[key].value = options[key];
      }
    }

    if (options["enableJittering"] === true) this.fullscreenMaterial.defines.USE_JITTERING = "";
    if (options["MAX_STEPS"]) this.fullscreenMaterial.defines.MAX_STEPS = options["MAX_STEPS"];
    if (options["NUM_BINARY_SEARCH_STEPS"]) this.fullscreenMaterial.defines.NUM_BINARY_SEARCH_STEPS = options["NUM_BINARY_SEARCH_STEPS"];
    const width = options.width || window.innerWidth;
    const height = options.height || window.innerHeight;
    this.renderTarget = new WebGLRenderTarget(width, height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter
    });
    this.renderPass = new RenderPass(scene, camera);

    _classPrivateFieldSet(this, _useMRT, options.useMRT && WEBGL.isWebGL2Available());

    if (_classPrivateFieldGet(this, _useMRT)) {
      // buffers: normal, depth (2), roughness will be written to the alpha channel of the normal buffer
      this.gBuffersRenderTarget = new WebGLMultipleRenderTargets(width, height, 2, {
        minFilter: NearestMipmapNearestFilter,
        magFilter: NearestMipmapNearestFilter,
        generateMipmaps: true
      });
      this.normalTexture = this.gBuffersRenderTarget.texture[0];
      this.depthTexture = this.gBuffersRenderTarget.texture[1];
      this.fullscreenMaterial.defines.USE_ROUGHNESSMAP = true;
    } else {
      // depth pass
      _classPrivateFieldSet(this, _webgl1DepthPass, new DepthPass(scene, camera));

      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.minFilter = NearestMipmapNearestFilter;
      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.magFilter = NearestMipmapNearestFilter;
      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.generateMipmaps = true;
      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.texture.minFilter = NearestMipmapNearestFilter;
      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.texture.magFilter = NearestMipmapNearestFilter;
      _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget.texture.generateMipmaps = true;

      _classPrivateFieldGet(this, _webgl1DepthPass).setSize(window.innerWidth, window.innerHeight);

      this.gBuffersRenderTarget = new WebGLRenderTarget(width, height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter
      });
      this.normalTexture = this.gBuffersRenderTarget.texture;
      this.depthTexture = _classPrivateFieldGet(this, _webgl1DepthPass).texture;
    }

    this.createLastFramebufferTexture();
  }

  createLastFramebufferTexture(width = window.innerWidth, height = window.innerHeight) {
    if (this.framebufferTexture !== undefined) this.framebufferTexture.dispose();
    this.framebufferTexture = new FramebufferTexture(width, height, RGBAFormat);
  }

  setSize(width, height) {
    this.renderTarget.setSize(width, height);
    this.gBuffersRenderTarget.setSize(width, height);
    this.createLastFramebufferTexture(width, height);
  }

  render(renderer, inputBuffer) {
    if (this.samples === undefined) this.samples = 1;

    if (this.staticNoise) {
      // this.samples = this.samples === 1 ? 2 : 1
      this.samples = 1;
    } else {
      this.samples++;
    }

    if (_classPrivateFieldGet(this, _webgl1DepthPass) !== null) {
      _classPrivateFieldGet(this, _webgl1DepthPass).renderPass.render(renderer, _classPrivateFieldGet(this, _webgl1DepthPass).renderTarget);
    }

    _classPrivateMethodGet(this, _setNormalDepthRoughnessMaterialInScene, _setNormalDepthRoughnessMaterialInScene2).call(this);

    renderer.setRenderTarget(this.gBuffersRenderTarget);
    this.renderPass.render(renderer, this.gBuffersRenderTarget, this.gBuffersRenderTarget);

    _classPrivateMethodGet(this, _unsetNormalDepthRoughnessMaterialInScene, _unsetNormalDepthRoughnessMaterialInScene2).call(this);

    this.fullscreenMaterial.uniforms.inputBuffer.value = inputBuffer.texture;
    this.fullscreenMaterial.uniforms.normalBuffer.value = this.normalTexture;
    this.fullscreenMaterial.uniforms.depthBuffer.value = this.depthTexture;
    this.fullscreenMaterial.uniforms.samples.value = this.samples;
    this.fullscreenMaterial.uniforms.lastFrameReflectionsBuffer.value = this.framebufferTexture;
    this.fullscreenMaterial.uniforms.cameraMatrixWorld.value = this._camera.matrixWorld;
    this.fullscreenMaterial.uniforms._projectionMatrix.value = this._camera.projectionMatrix;
    this.fullscreenMaterial.uniforms._inverseProjectionMatrix.value = this._camera.projectionMatrixInverse;
    this.fullscreenMaterial.uniforms.cameraNear.value = this._camera.near;
    this.fullscreenMaterial.uniforms.cameraFar.value = this._camera.far;
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.scene, this.camera);
  }

}

function _setNormalDepthRoughnessMaterialInScene2() {
  this._scene.traverse(c => {
    if (c.material) {
      const origMat = c.material;
      _classPrivateFieldGet(this, _defaultMaterials2)[c.material.uuid] = origMat;

      if (_classPrivateFieldGet(this, _normalDepthMaterials)[origMat.uuid] === undefined) {
        _classPrivateFieldGet(this, _normalDepthMaterials)[origMat.uuid] = new NormalDepthRoughnessMaterial();

        const normalDepthMaterial = _classPrivateFieldGet(this, _normalDepthMaterials)[origMat.uuid];

        if (_classPrivateFieldGet(this, _useMRT)) {
          normalDepthMaterial.defines.USE_MRT = "";
        }

        normalDepthMaterial._originalUuid = c.material.uuid;
        normalDepthMaterial.normalScale = origMat.normalScale;
        normalDepthMaterial.uniforms.normalMap = new Uniform(null);
        normalDepthMaterial.uniforms.normalMap.value = origMat.normalMap;
        Object.defineProperty(normalDepthMaterial.uniforms.roughness, "value", {
          get() {
            return origMat.roughness || 0;
          },

          set(_) {}

        });

        if (_classPrivateFieldGet(this, _options).useNormalMap && origMat.normalMap) {
          normalDepthMaterial.normalMap = origMat.normalMap;
          normalDepthMaterial.defines.USE_NORMALMAP = "";
        }

        if (_classPrivateFieldGet(this, _options).useRoughnessMap && origMat.roughnessMap) {
          normalDepthMaterial.uniforms.roughnessMap.value = origMat.roughnessMap;
          normalDepthMaterial.defines.USE_ROUGHNESSMAP = "";
        }

        normalDepthMaterial.uniforms.normalScale.value = origMat.normalScale;
        const map = origMat.map || origMat.normalMap || origMat.roughnessMap || origMat.metalnessMap;
        if (map) normalDepthMaterial.uniforms.uvTransform.value = map.matrix;
      }

      const normalDepthMaterial = _classPrivateFieldGet(this, _normalDepthMaterials)[c.material.uuid];

      c.material = normalDepthMaterial;
    }
  });
}

function _unsetNormalDepthRoughnessMaterialInScene2() {
  this._scene.traverse(c => {
    if (c.material) c.material = _classPrivateFieldGet(this, _defaultMaterials2)[c.material._originalUuid];
  });
}

const zeroVec2 = new Vector2();
const defaultOptions = {
  width: window.innerWidth,
  height: window.innerHeight,
  useBlur: true,
  blurKernelSize: KernelSize.SMALL,
  blurWidth: window.innerWidth,
  blurHeight: window.innerHeight,
  rayStep: 0.1,
  intensity: 1,
  depthBlur: 0.1,
  maxBlur: 1,
  enableJittering: false,
  jitter: 0.1,
  jitterSpread: 0.1,
  jitterRough: 0.1,
  roughnessFadeOut: 1,
  MAX_STEPS: 20,
  NUM_BINARY_SEARCH_STEPS: 5,
  maxDepthDifference: 3,
  maxDepth: 1,
  thickness: 10,
  ior: 1.45,
  stretchMissedRays: false,
  useMRT: true,
  useNormalMap: true,
  useRoughnessMap: true
};

class SSRPass extends Pass {
  constructor(scene, camera, options = defaultOptions) {
    super("SSRPass");
    this.needsDepthTexture = true;
    this._camera = camera;
    options = _objectSpread(_objectSpread({}, defaultOptions), options);
    this.fullscreenMaterial = new SSRCompositeMaterial(); // returns just the calculates reflections

    this.reflectionsPass = new ReflectionsPass(scene, camera, options);
    this.composeReflectionsPass = new ComposeReflectionsPass(scene, camera);
    this.reflectionsPass.setSize(options.width, options.height);

    if (options.useBlur) {
      this.fullscreenMaterial.defines.USE_BLUR = "";
      this.reflectionsPass.fullscreenMaterial.defines.USE_BLUR = "";
    }

    if (options.stretchMissedRays) {
      this.reflectionsPass.fullscreenMaterial.defines.STRETCH_MISSED_RAYS = "";
    } // used to smooth out reflections by blurring them (more blur the longer the ray is)


    this.kawaseBlurPass = new KawaseBlurPass();
    this.kawaseBlurPass.kernelSize = options.blurKernelSize;
    const parameters = {
      minFilter: LinearFilter,
      magFilter: LinearFilter
    };
    this.kawaseBlurPassRenderTarget = new WebGLRenderTarget(options.blurWidth, options.blurHeight, parameters);
    this.velocityPass = new VelocityPass(scene, camera);
    this.temporalResolve = options.temporalResolve === true;
    if (this.temporalResolve) this.composeReflectionsPass.fullscreenMaterial.defines.TEMPORAL_RESOLVE = "";
  }

  setSize(width, height) {
    this.reflectionsPass.setSize(width, height);
  }

  get reflectionUniforms() {
    return this.reflectionsPass.fullscreenMaterial.uniforms;
  }

  render(renderer, inputBuffer, outputBuffer) {
    this.velocityPass.render(renderer, inputBuffer); // render reflections of current frame

    this.reflectionsPass.render(renderer, inputBuffer, this.reflectionsPass.renderTarget);
    const samplesVal = this.reflectionsPass.samples; // compose reflection of last and current frame into one reflection

    this.composeReflectionsPass.fullscreenMaterial.uniforms.inputBuffer.value = this.reflectionsPass.renderTarget.texture;
    this.composeReflectionsPass.fullscreenMaterial.uniforms.lastFrameReflectionsBuffer.value = this.reflectionsPass.framebufferTexture;
    this.composeReflectionsPass.fullscreenMaterial.uniforms.velocityBuffer.value = this.velocityPass.renderTarget.texture;
    this.composeReflectionsPass.fullscreenMaterial.uniforms.samples.value = samplesVal;
    this.composeReflectionsPass.render(renderer, this.reflectionsPass.renderTarget, this.composeRenderTarget); // save reflections of last frame

    renderer.setRenderTarget(this.composeReflectionsPass.renderTarget);
    renderer.copyFramebufferToTexture(zeroVec2, this.reflectionsPass.framebufferTexture);
    const useBlur = ("USE_BLUR" in this.fullscreenMaterial.defines);

    if (useBlur) {
      renderer.setRenderTarget(this.kawaseBlurPassRenderTarget);
      this.kawaseBlurPass.render(renderer, this.composeReflectionsPass.renderTarget, this.kawaseBlurPassRenderTarget);
    }

    const blurredReflectionsBuffer = useBlur ? this.kawaseBlurPassRenderTarget.texture : null;
    this.fullscreenMaterial.uniforms.inputBuffer.value = inputBuffer.texture;
    this.fullscreenMaterial.uniforms.reflectionsBuffer.value = this.composeReflectionsPass.renderTarget.texture;
    this.fullscreenMaterial.uniforms.blurredReflectionsBuffer.value = blurredReflectionsBuffer;
    this.fullscreenMaterial.uniforms.samples.value = samplesVal;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }

}

export { SSRPass };
