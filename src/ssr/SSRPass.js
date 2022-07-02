﻿import { KawaseBlurPass, KernelSize, Pass } from "postprocessing"
import { Vector2 } from "three"
import { LinearFilter, WebGLRenderTarget } from "three"
import { ComposeReflectionsPass } from "./ComposeReflectionsPass.js"
import { SSRCompositeMaterial } from "./material/SSRCompositeMaterial.js"
import { ReflectionsPass } from "./ReflectionsPass.js"

const zeroVec2 = new Vector2()

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
}

export class SSRPass extends Pass {
	constructor(scene, camera, options = defaultOptions) {
		super("SSRPass")

		this.needsDepthTexture = true

		this._camera = camera
		options = { ...defaultOptions, ...options }

		this.fullscreenMaterial = new SSRCompositeMaterial()

		// returns just the calculates reflections
		this.reflectionsPass = new ReflectionsPass(scene, camera, options)

		this.composeReflectionsPass = new ComposeReflectionsPass(scene, camera)

		this.reflectionsPass.setSize(options.width, options.height)

		if (options.useBlur) {
			this.fullscreenMaterial.defines.USE_BLUR = ""
			this.reflectionsPass.fullscreenMaterial.defines.USE_BLUR = ""
		}

		if (options.stretchMissedRays) {
			this.reflectionsPass.fullscreenMaterial.defines.STRETCH_MISSED_RAYS = ""
		}

		// used to smooth out reflections by blurring them (more blur the longer the ray is)
		this.kawaseBlurPass = new KawaseBlurPass()
		this.kawaseBlurPass.kernelSize = options.blurKernelSize

		const parameters = {
			minFilter: LinearFilter,
			magFilter: LinearFilter
		}

		this.kawaseBlurPassRenderTarget = new WebGLRenderTarget(
			options.blurWidth,
			options.blurHeight,
			parameters
		)
	}

	setSize(width, height) {
		this.reflectionsPass.setSize(width, height)
	}

	get reflectionUniforms() {
		return this.reflectionsPass.fullscreenMaterial.uniforms
	}

	render(renderer, inputBuffer, outputBuffer) {
		// render reflections of current frame
		this.reflectionsPass.render(
			renderer,
			inputBuffer,
			this.reflectionsPass.renderTarget
		)

		// compose reflection of last and current frame into one reflection
		this.composeReflectionsPass.fullscreenMaterial.uniforms.inputBuffer.value =
			this.reflectionsPass.renderTarget.texture
		this.composeReflectionsPass.fullscreenMaterial.uniforms.lastFrameReflectionsBuffer.value =
			this.reflectionsPass.framebufferTexture

		this.composeReflectionsPass.render(
			renderer,
			this.reflectionsPass.renderTarget,
			this.composeRenderTarget
		)

		const useBlur = "USE_BLUR" in this.fullscreenMaterial.defines

		if (useBlur) {
			renderer.setRenderTarget(this.kawaseBlurPassRenderTarget)
			this.kawaseBlurPass.render(
				renderer,
				this.composeReflectionsPass.renderTarget,
				this.kawaseBlurPassRenderTarget
			)
		}

		const blurredReflectionsBuffer = useBlur
			? this.kawaseBlurPassRenderTarget.texture
			: null

		this.fullscreenMaterial.uniforms.inputBuffer.value = inputBuffer.texture
		this.fullscreenMaterial.uniforms.lastFrameReflectionsBuffer.value =
			this.reflectionsPass.framebufferTexture
		this.fullscreenMaterial.uniforms.reflectionsBuffer.value =
			this.composeReflectionsPass.renderTarget.texture
		this.fullscreenMaterial.uniforms.blurredReflectionsBuffer.value =
			blurredReflectionsBuffer
		this.fullscreenMaterial.uniforms.samples.value =
			this.reflectionsPass.frameVal

		renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
		renderer.render(this.scene, this.camera)

		// save reflections of last frame
		renderer.setRenderTarget(this.reflectionsPass.renderTarget)
		renderer.copyFramebufferToTexture(
			zeroVec2,
			this.reflectionsPass.framebufferTexture
		)
	}
}
