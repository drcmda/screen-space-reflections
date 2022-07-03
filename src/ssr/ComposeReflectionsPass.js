import { Pass } from "postprocessing"
import { WebGLRenderTarget } from "three"
import { NearestFilter } from "three"
import { Uniform } from "three"
import { ShaderMaterial } from "three"
import vertexShader from "./material/shader/ssrMaterial.vert"

export class ComposeReflectionsPass extends Pass {
	constructor(scene, camera) {
		super("ReflectionsPass")

		this._scene = scene
		this._camera = camera

		this.renderTarget = new WebGLRenderTarget(
			window.innerWidth,
			window.innerHeight,
			{
				minFilter: NearestFilter,
				magFilter: NearestFilter
			}
		)

		this.fullscreenMaterial = new ShaderMaterial({
			type: "ComposeReflectionsMaterial",
			uniforms: {
				inputBuffer: new Uniform(null),
				lastFrameReflectionsBuffer: new Uniform(null),
				samples: new Uniform(null)
			},
			vertexShader,
			fragmentShader: /* glsl */ `
				#define EULER 2.718281828459045

                uniform sampler2D inputBuffer;
                uniform sampler2D lastFrameReflectionsBuffer;

				uniform float samples;

                varying vec2 vUv;

                void main() {
                    vec4 inputTexel = texture2D(inputBuffer, vUv);
                    vec4 lastFrameReflectionsTexel = texture2D(lastFrameReflectionsBuffer, vUv);
					
					float mixVal = 1. / samples;
					mixVal /= EULER;

					vec3 newColor = mix(lastFrameReflectionsTexel.rgb, lastFrameReflectionsTexel.rgb + inputTexel.rgb, mixVal);
					if(samples <= 2.) newColor = lastFrameReflectionsTexel.rgb + inputTexel.rgb;

					if(length(lastFrameReflectionsTexel.rgb) < 0.001){
						newColor = mix(lastFrameReflectionsTexel.rgb, lastFrameReflectionsTexel.rgb + inputTexel.rgb, 0.25);
					}

					float blurMix = mix(lastFrameReflectionsTexel.a, inputTexel.a + 0.5, mixVal);
					
					gl_FragColor = vec4(newColor, blurMix);
                }
            `
		})
	}

	render(renderer, inputBuffer) {
		renderer.setRenderTarget(this.renderTarget)
		renderer.render(this.scene, this.camera)
	}
}
