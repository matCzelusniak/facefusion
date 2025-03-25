import { Context } from "koa";
import { FaceFusionService } from "@app/services/facefusion-service";
import { IProcessingOptions } from "@app/types/facefusion.types";
import fs from "fs";

interface RequestBody {
	options?: Partial<IProcessingOptions>;
}

export class FaceFusionController {
	private service: FaceFusionService;

	constructor() {
		this.service = new FaceFusionService();
	}

	public process = async (ctx: Context) => {
		try {
			const body = ctx.request.body as RequestBody;
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

			const result = await this.service.processMedia({
				targetMedia: targetMediaBuffer,
				sourceImage: sourceImageBuffer,
				options: (body.options ||
					FaceFusionService.defaultOptions) as IProcessingOptions,
			});

			// Set appropriate content type based on result type
			if (body.options?.mediaTypeOutput === "video") {
				ctx.set("Content-Type", "video/mp4");
			} else {
				ctx.set("Content-Type", "image/webp");
			}

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
