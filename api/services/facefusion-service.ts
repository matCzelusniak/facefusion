import {
	IProcessRequestBody,
	IProcessResponse,
	TProcessingOptions,
} from "@app/types/facefusion.types";
import { CloudflareService } from "./cloudflare-service";
import { NotificationService } from "./notification-service";
const { spawn } = require("child_process");
const path = require("path");
export class FaceFusionService {
	public static defaultOptions: TProcessingOptions = {
		processors: ["face_swapper", "face_enhancer"],
		faceEnhancerModel: "gfpgan_1.4",
		faceSwapperModel: "inswapper_128",
	};

	private cloudflareService: CloudflareService;
	private notificationService: NotificationService;

	constructor() {
		this.cloudflareService = new CloudflareService();
		this.notificationService = new NotificationService();
	}

	public async processMedia(
		request: IProcessRequestBody,
		sourcePath: string,
		targetPath: string,
		outputPath: string
	): Promise<IProcessResponse> {
		if (!request.jobId || request.jobId.trim() === "") {
			return {
				success: false,
				error: "jobId is required and cannot be empty",
			};
		}

		const initialResponse: IProcessResponse = {
			success: true,
			jobId: request.jobId,
		};

		this.processMediaBackground(
			request,
			sourcePath,
			targetPath,
			outputPath
		).catch((err) => console.error("Background processing error:", err));

		return initialResponse;
	}

	private async processMediaBackground(
		request: IProcessRequestBody,
		sourcePath: string,
		targetPath: string,
		outputPath: string
	): Promise<void> {
		const jobId = request.jobId;
		try {
			if (!request.targetMedia || !request.sourceImage) {
				throw new Error("Missing required media files");
			}

			// Upload target file to Cloudflare for temporary storage
			// const sourceBuffer = await fs.promises.readFile(sourcePath);
			// const sourceFileType = path.extname(sourcePath).toLowerCase();
			// const isSourceVideo = [".mp4", ".mov", ".webm", ".avi"].includes(
			// 	sourceFileType
			// );
			// const sourceUploadResult = isSourceVideo
			// 	? await this.cloudflareService.uploadVideoToCloudflare(
			// 			sourcePath,
			// 			`source_${jobId.toString()}`,
			// 			{ fileType: sourceFileType }
			// 	  )
			// 	: await this.cloudflareService.uploadImageToCloudflare(
			// 			sourcePath,
			// 			`source_${jobId}`
			// 	  );

			// console.log("source upload result", sourceUploadResult);

			//const targetBuffer = await fs.promises.readFile(targetPath);
			// const targetFileType = path.extname(targetPath).toLowerCase();
			// const isTargetVideo = [".mp4", ".mov", ".webm", ".avi"].includes(
			// 	targetFileType
			// );

			// //Commented out for now
			// const targetUploadResult = isTargetVideo
			// 	? await this.cloudflareService.uploadVideoToCloudflare(
			// 			targetPath,
			// 			`target_${jobId}`,
			// 			{
			// 				fileType: targetFileType,
			// 			}
			// 	  )
			// 	: await this.cloudflareService.uploadImageToCloudflare(
			// 			targetPath,
			// 			`target_${jobId}`
			// 	  );

			// console.log("target upload result", targetUploadResult);
			// console.log("jobId", jobId);

			// await this.notificationService.sendNotification({
			// 	jobId,
			// 	success: true,
			// 	mediaType: isTargetVideo ? "video" : "image",
			// 	cloudflareId: targetUploadResult.id,
			// 	cloudflareUrl: targetUploadResult.url,
			// });

			// console.log("all options");
			// console.log(request.options);

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
				...Object.entries(request.options).flatMap(([key, value]) => {
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
							const fileType = path
								.extname(outputPath)
								.toLowerCase();
							const isVideo = [
								".mp4",
								".mov",
								".webm",
								".avi",
							].includes(fileType);

							let uploadResult;
							if (isVideo) {
								uploadResult =
									await this.cloudflareService.uploadVideoToCloudflare(
										outputPath,
										jobId,
										{
											fileType: fileType,
										}
									);
							} else {
								uploadResult =
									await this.cloudflareService.uploadImageToCloudflare(
										outputPath,
										jobId
									);
							}

							await this.notificationService.sendNotification({
								jobId,
								success: true,
								mediaType: isVideo ? "video" : "image",
								cloudflareId: uploadResult.id,
								cloudflareUrl: uploadResult.url,
							});

							resolve();
						} else {
							console.log(
								"Error in processMediaBackground",
								errorData
							);
							await this.notificationService.sendNotification({
								jobId,
								success: false,
								error: errorData || "Process failed",
							});

							reject(new Error(errorData || "Process failed"));
						}
					} catch (error) {
						console.log("Error in processMediaBackground", error);
						await this.notificationService.sendNotification({
							jobId,
							success: false,
							error:
								error instanceof Error
									? error.message
									: "Unknown error",
						});

						reject(error);
					}
				});

				process.on("error", async (err: Error) => {
					console.log("Error in processMediaBackground", err);
					await this.notificationService.sendNotification({
						jobId,
						success: false,
						error: err.message,
					});

					reject(err);
				});
			});
		} catch (error) {
			console.log("Error in processMediaBackground", error);
			await this.notificationService.sendNotification({
				jobId,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});

			throw error;
		}
	}
}
