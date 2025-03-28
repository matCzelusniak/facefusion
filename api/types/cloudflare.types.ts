export type TusUpload = any;

export interface FileReader {
	openFile(): Promise<void>;
	readChunk(offset: number, length: number): Promise<Buffer>;
	closeFile(): Promise<void>;
}

export interface VideoUploadOptions {
	endpoint: string;
	headers: Record<string, string>;
	metadata: {
		name: string;
		filetype: string;
		scheduleddeletion?: string;
	};
	chunkSize: number;
	onSuccess: () => void;
	onError: (error: Error) => void;
	onProgress: (bytesUploaded: number, bytesTotal: number) => void;
	uploadSize?: number;
	uploadLengthDeferred?: boolean;
	fileReader?: FileReader;
}

export interface VideoDetails {
	uid: string;
	preview: string;
	[key: string]: unknown;
}

export interface ImageUploadResponse {
	id: string;
	url: string;
}

export interface VideoUploadResponse {
	id: string;
	url: string;
}
