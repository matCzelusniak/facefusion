import {
	IProcessRequest,
	IProcessResponse,
	IProcessingOptions,
} from "@app/types/facefusion.types";
const { spawn } = require("child_process");
const fs = require("fs");

export class FaceFusionService {
	public static defaultOptions: IProcessingOptions = {
		processors: ["face_swapper", "face_enhancer"],
		faceEnhancerModel: "gfpgan_1.4",
		faceSwapperModel: "inswapper_128",
		pixelBoost: "512x512",
		mediaTypeOutput: "image",
	};

	public async processMedia(
		request: IProcessRequest
	): Promise<IProcessResponse> {
		try {
			const options = {
				...FaceFusionService.defaultOptions,
				...request.options,
			};

			console.log(options);

			if (!request.targetMedia || !request.sourceImage) {
				throw new Error("Missing required media files");
			}

			// Create unique filenames
			const timestamp = Date.now();
			const tempSourcePath = `/tmp/input/source_${timestamp}.webp`;
			const tempTargetPath = `/tmp/target/target_${timestamp}.webp`;
			const outputPath = `/tmp/output/output_${timestamp}.webp`;

			// Write temporary files
			await fs.promises.writeFile(tempSourcePath, request.sourceImage);
			await fs.promises.writeFile(tempTargetPath, request.targetMedia);

			const process = spawn(
				"python",
				[
					"facefusion.py",
					"headless-run",
					"--execution-providers",
					"cuda",
					"--source",
					tempSourcePath,
					"--target",
					tempTargetPath,
					"--face-swapper-model",
					options.faceSwapperModel,
					"--output-path",
					outputPath,
					"--processors",
					...options.processors,
				],
				{
					cwd: "/facefusion",
				}
			);

			return new Promise((resolve, reject) => {
				let errorData = "";

				process.stderr.on("data", (data: Buffer) => {
					console.log("stderr", data.toString());
					errorData += data.toString();
				});

				process.on("close", async (code: number) => {
					try {
						if (code === 0) {
							const outputBuffer = await fs.promises.readFile(
								outputPath
							);

							// await fs.promises.unlink(tempSourcePath);
							// await fs.promises.unlink(tempTargetPath);
							// await fs.promises.unlink(outputPath);

							resolve({
								success: true,
								result: outputBuffer,
							});
						} else {
							// await fs.promises
							// 	.unlink(tempSourcePath)
							// 	.catch(() => {});
							// await fs.promises
							// 	.unlink(tempTargetPath)
							// 	.catch(() => {});
							// await fs.promises
							// 	.unlink(outputPath)
							// 	.catch(() => {});

							resolve({
								success: false,
								error: errorData || "Process failed",
							});
						}
					} catch (error) {
						// await fs.promises
						// 	.unlink(tempSourcePath)
						// 	.catch(() => {});
						// await fs.promises
						// 	.unlink(tempTargetPath)
						// 	.catch(() => {});
						// await fs.promises.unlink(outputPath).catch(() => {});
						reject(error);
					}
				});

				process.on("error", async (err: Error) => {
					// await fs.promises.unlink(tempSourcePath).catch(() => {});
					// await fs.promises.unlink(tempTargetPath).catch(() => {});
					// await fs.promises.unlink(outputPath).catch(() => {});
					reject(err);
				});
			});
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Unknown error occurred",
			};
		}
	}
}
