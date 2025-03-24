import { Request } from "koa";

declare module "koa" {
	interface Request {
		files?: {
			[key: string]: {
				size: number;
				buffer: Buffer;
			};
		};
	}
}
