export interface IProcessingOptions {
	processors: ("face_swapper" | "face_enhancer")[];
	faceEnhancerModel: string;
	faceSwapperModel: string;
	pixelBoost: string;
}

export interface IProcessRequest {
	targetMedia: Buffer;
	sourceImage: Buffer;
	options: IProcessingOptions;
}

export interface IProcessResponse {
	success: boolean;
	result?: Buffer;
	error?: string;
}
