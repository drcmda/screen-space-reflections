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
				lastFrameReflectionsBuffer: new Uniform(null)
			},
			vertexShader,
			fragmentShader: /* glsl */ `
                uniform sampler2D inputBuffer;
                uniform sampler2D lastFrameReflectionsBuffer;

                uniform float samples;

                varying vec2 vUv;

                void main() {
                    vec4 inputTexel = texture2D(inputBuffer, vUv);
                    vec4 lastFrameReflectionsTexel = texture2D(lastFrameReflectionsBuffer, vUv);

                    gl_FragColor = vec4((inputTexel.rgb + lastFrameReflectionsTexel.rgb) / 2., inputTexel.a);
                }
            `
		})
	}

	render(renderer, inputBuffer) {
		renderer.setRenderTarget(this.renderTarget)
		renderer.render(this.scene, this.camera)
	}
}
