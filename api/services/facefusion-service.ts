import {
	IProcessRequestBody,
	IProcessResponse,
	TProcessingOptions,
} from "@app/types/facefusion.types";
const { spawn } = require("child_process");
const fs = require("fs");

export class FaceFusionService {
	public static defaultOptions: TProcessingOptions = {
		processors: ["face_swapper", "face_enhancer"],
		faceEnhancerModel: "gfpgan_1.4",
		faceSwapperModel: "inswapper_128",
	};

	public async processMedia(
		request: IProcessRequestBody,
		sourcePath: string,
		targetPath: string,
		outputPath: string
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

			// Write temporary files
			// await fs.promises.writeFile(tempSourcePath, request.sourceImage);
			// await fs.promises.writeFile(tempTargetPath, request.targetMedia);
			console.log("all options");
			console.log(options);

			const commandArgs = [
				"facefusion.py",
				"headless-run",
				"--execution-providers",
				"cuda",
				"--source",
				sourcePath,
				"--target",
				targetPath,
				"--output-path",
				outputPath,
				...Object.entries(options).flatMap(([key, value]) => {
					const paramName = `--${key.replace(
						/[A-Z]/g,
						(letter) => `-${letter.toLowerCase()}`
					)}`;

					if (Array.isArray(value)) {
						return [paramName, ...value];
					}
					return [paramName, value.toString()];
				}),
			];

			console.log(
				"Executing command:",
				["python", ...commandArgs].join(" ")
			);

			const process = spawn("python", commandArgs, {
				cwd: "/facefusion",
			});

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
