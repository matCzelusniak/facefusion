export type TProcessingOptions = {
	[key: string]: string | number | boolean | string[] | number[] | boolean[];
};

export interface IProcessRequestBody {
	targetMedia: Buffer;
	sourceImage: Buffer;
	options: TProcessingOptions;
	jobId: string;
}

export interface IProcessResponse {
	success: boolean;
	result?: Buffer;
	error?: string;
	jobId?: string;
}

export interface INotificationData {
	jobId: string;
	success: boolean;
	mediaType?: string;
	cloudflareId?: string;
	cloudflareUrl?: string;
	error?: string;
}
