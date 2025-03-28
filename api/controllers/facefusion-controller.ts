import { Context } from "koa";
import { FaceFusionService } from "@app/services/facefusion-service";
import {
	IProcessRequestBody,
	TProcessingOptions,
} from "@app/types/facefusion.types";
import fs from "fs";

export class FaceFusionController {
	private service: FaceFusionService;

	constructor() {
		this.service = new FaceFusionService();
	}

	public process = async (ctx: Context) => {
		try {
			const body = ctx.request.body as IProcessRequestBody;
			console.log("Debugging body:", body);
			const files = ctx.request.files as {
				[fieldname: string]: Express.Multer.File[];
			};

			console.log("Debugging files object:", files);
			const sanitizedJobId = body.jobId.replace(/['"`]/g, "");

			if (!files) {
				ctx.status = 400;
				ctx.body = { success: false, error: "No files received" };
				return;
			}

			if (!body.jobId || body.jobId.trim() === "") {
				ctx.status = 400;
				ctx.body = {
					success: false,
					error: "jobId is required and cannot be empty",
				};
				return;
			}

			const targetMediaFile = files.targetMedia?.[0];
			const sourceImageFile = files.sourceImage?.[0];

			if (!targetMediaFile || !sourceImageFile) {
				ctx.status = 400;
				ctx.body = { success: false, error: "Missing required files" };
				return;
			}

			const targetMediaBuffer = fs.readFileSync(targetMediaFile.path);
			const sourceImageBuffer = fs.readFileSync(sourceImageFile.path);

			const timestamp = Date.now();

			const targetExt =
				targetMediaFile.originalname.substring(
					targetMediaFile.originalname.lastIndexOf(".") + 1
				) || "webp";

			const outputPath = `/tmp/output/output_${timestamp}.${targetExt}`;

			const result = await this.service.processMedia(
				{
					targetMedia: targetMediaBuffer,
					sourceImage: sourceImageBuffer,
					options: (() => {
						if (typeof body.options === "string") {
							try {
								return JSON.parse(body.options);
							} catch (e) {
								console.error(
									"Failed to parse options string:",
									e
								);
								return FaceFusionService.defaultOptions;
							}
						} else if (
							body.options &&
							typeof body.options === "object"
						) {
							return body.options;
						} else {
							return FaceFusionService.defaultOptions;
						}
					})() as TProcessingOptions,
					jobId: sanitizedJobId,
				},
				sourceImageFile.path,
				targetMediaFile.path,
				outputPath
			);

			ctx.status = 200;
			ctx.body = {
				success: true,
				jobId: result.jobId,
				message: "Processing started",
			};
		} catch (error) {
			ctx.status = 500;
			ctx.body = {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Unknown error occurred",
			};
		}
	};
}
