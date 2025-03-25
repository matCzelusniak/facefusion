import {
	IProcessRequest,
	IProcessResponse,
	IProcessingOptions,
} from "@app/types/facefusion.types";
const { spawn } = require("child_process");

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

			const extension =
				options.mediaTypeOutput === "image" ? "webp" : "mp4";
			const outputFilename = `output.${extension}`;

			const process = spawn(
				"python",
				[
					"facefusion.py",
					"run",
					"--execution-providers",
					"cuda",
					"--source",
					request.sourceImage,
					"--target",
					request.targetMedia,
					"--model",
					options.faceSwapperModel,
					"--output",
					outputFilename,
				],
				{
					cwd: "/facefusion",
				}
			);

			// const process = spawn("ls", ["-l"]);

			return new Promise((resolve, reject) => {
				let outputData = Buffer.from("");
				let errorData = "";

				process.stdout.on("data", (data: Buffer) => {
					console.log("stdout", data.toString());
					outputData = Buffer.concat([outputData, data]);
				});

				process.stderr.on("data", (data: Buffer) => {
					console.log("stderr", data.toString());
					errorData += data.toString();
				});

				process.on("close", (code: number) => {
					if (code === 0) {
						resolve({
							success: true,
							result: outputData,
						});
					} else {
						resolve({
							success: false,
							error: errorData || "Process failed",
						});
					}
				});

				process.on("error", (err: Error) => {
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
