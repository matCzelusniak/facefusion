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

			if (!files) {
				ctx.status = 400;
				ctx.body = { success: false, error: "No files received" };
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

			// Create unique filenames
			const timestamp = Date.now();

			// Extract file extensions from original filenames
			const targetExt =
				targetMediaFile.originalname.substring(
					targetMediaFile.originalname.lastIndexOf(".") + 1
				) || "webp";

			const outputPath = `/tmp/output/output_${timestamp}.${targetExt}`;

			const result = await this.service.processMedia(
				{
					targetMedia: targetMediaBuffer,
					sourceImage: sourceImageBuffer,
					options: (typeof body.options === "string"
						? JSON.parse(body.options)
						: body.options ||
						  FaceFusionService.defaultOptions) as TProcessingOptions,
				},
				sourceImageFile.path,
				targetMediaFile.path,
				outputPath
			);

			// Set appropriate content type based on result type
			// if (body.outputType === "video") {
			// 	ctx.set("Content-Type", "video/mp4");
			// } else {
			// 	ctx.set("Content-Type", "image/webp");
			// }

			// Set the response body with the processed media
			ctx.body = result.result;
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
