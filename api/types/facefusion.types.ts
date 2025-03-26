export type TProcessingOptions = {
	[key: string]: string | number | boolean | string[] | number[] | boolean[];
};

export interface IProcessRequestBody {
	targetMedia: Buffer;
	sourceImage: Buffer;
	outputType: "video" | "image";
	options: TProcessingOptions;
}

export interface IProcessResponse {
	success: boolean;
	result?: Buffer;
	error?: string;
}
