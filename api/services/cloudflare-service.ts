import config from "../utils/config";
import {
	VideoDetails,
	VideoUploadOptions,
	ImageUploadResponse,
	VideoUploadResponse,
} from "../types/cloudflare.types";

const fetch = require("node-fetch");
const FormData = require("form-data");
const tus = require("tus-js-client");
const fs = require("fs");

type TusUploadInstance = ReturnType<typeof tus.Upload>;

export class CloudflareService {
	private readonly CLOUDFLARE_IMAGES_ENDPOINT: string;
	private readonly CLOUDFLARE_API_TOKEN: string;
	private readonly CLOUDFLARE_ACCOUNT_ID: string;
	private readonly CLOUDFLARE_TUS_ENDPOINT: string;

	constructor() {
		this.CLOUDFLARE_IMAGES_ENDPOINT =
			"https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1";
		this.CLOUDFLARE_API_TOKEN = config.CLOUDFLARE_API_TOKEN;
		this.CLOUDFLARE_ACCOUNT_ID = config.CLOUDFLARE_ACCOUNT_ID;
		this.CLOUDFLARE_TUS_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${this.CLOUDFLARE_ACCOUNT_ID}/stream`;
	}

	public async uploadImageToCloudflare(
		filePathOrBuffer: string | Buffer,
		jobId: string
	): Promise<ImageUploadResponse> {
		const filename = `${jobId}.webp`;

		console.log("uploadImageToCloudflare::filename", filename);

		const url = this.CLOUDFLARE_IMAGES_ENDPOINT.replace(
			"{account_id}",
			this.CLOUDFLARE_ACCOUNT_ID
		);

		try {
			console.log("Uploading image to Cloudflare Images...");

			const form = new FormData();

			if (typeof filePathOrBuffer === "string") {
				const fileStream = fs.createReadStream(filePathOrBuffer);
				form.append("file", fileStream, {
					filename,
					contentType: "image/webp",
				});
			} else {
				form.append("file", filePathOrBuffer, {
					filename,
					contentType: "image/webp",
				});
			}

			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${
						this.CLOUDFLARE_API_TOKEN as string
					}`,
					...form.getHeaders(),
				},
				body: form,
			});

			const data = await response.json();

			if (!response.ok) {
				console.error("Failed to upload image to Cloudflare:", data);
				throw new Error(
					`Failed to upload image: ${
						data.errors?.[0]?.message || "Unknown error"
					}`
				);
			}

			console.log(
				`uploadImageToCloudflare::Image ${filename} uploaded to Cloudflare:`,
				data.result
			);
			return {
				id: data.result.id,
				url: data.result.variants[0],
			};
		} catch (error) {
			console.error("Error uploading to Cloudflare Images:", error);
			throw new Error(
				`Failed to upload image: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	public async uploadVideoToCloudflare(
		filePathOrBuffer: string | Buffer,
		jobId: string,
		extensionOrOptions:
			| string
			| { fileType?: string; scheduleddeletion?: Date } = ".mp4"
	): Promise<VideoUploadResponse> {
		let extension = ".mp4";
		let scheduleddeletion: string | undefined;

		if (typeof extensionOrOptions === "string") {
			extension = extensionOrOptions;
		} else if (
			extensionOrOptions &&
			typeof extensionOrOptions === "object"
		) {
			if (extensionOrOptions.fileType) {
				extension = extensionOrOptions.fileType;
			}
			if (extensionOrOptions.scheduleddeletion) {
				scheduleddeletion =
					extensionOrOptions.scheduleddeletion.toString();
			}
		}

		if (!scheduleddeletion) {
			const defaultDeletionDate = new Date();
			defaultDeletionDate.setDate(defaultDeletionDate.getDate() + 31);
			scheduleddeletion = defaultDeletionDate.toISOString();
		}

		const filename = `${jobId}${extension}`;

		const contentType = extension === ".mp4" ? "video/mp4" : "video/webm";

		try {
			console.log(
				"Uploading video to Cloudflare Stream using tus protocol..."
			);

			const chunkSize = 5 * 1024 * 1024; // 5MB chunks

			return new Promise<VideoUploadResponse>((resolve, reject) => {
				const self = this;

				const uploadOptions: VideoUploadOptions = {
					endpoint: this.CLOUDFLARE_TUS_ENDPOINT,
					headers: {
						Authorization: `Bearer ${
							this.CLOUDFLARE_API_TOKEN as string
						}`,
					},
					metadata: {
						name: filename,
						filetype: contentType,
						scheduleddeletion: scheduleddeletion,
					},
					chunkSize: chunkSize,
					onSuccess: function () {
						try {
							if (!upload || !upload.url) {
								reject(new Error("Upload URL not available"));
								return;
							}

							const uploadUrl = upload.url;
							const videoId = uploadUrl.split("/").pop();

							if (!videoId) {
								reject(
									new Error(
										"Failed to extract video ID from upload URL"
									)
								);
								return;
							}

							console.log(
								"Video uploaded, waiting for processing..."
							);

							self.getVideoDetails(videoId)
								.then((videoDetails) => {
									console.log("Video details:", videoDetails);
									resolve({
										id: videoDetails.uid,
										url: videoDetails.preview,
									});
								})
								.catch((error) => {
									reject(error);
								});
						} catch (error) {
							reject(error);
						}
					},
					onError: (error: Error) => {
						console.error("Error during tus upload:", error);
						reject(
							new Error(
								`Failed to upload video: ${
									error.message || "Unknown error"
								}`
							)
						);
					},
					onProgress: (bytesUploaded: number, bytesTotal: number) => {
						const percentage = (
							(bytesUploaded / bytesTotal) *
							100
						).toFixed(2);
						console.log(`Upload progress: ${percentage}%`);
					},
				};

				let upload: TusUploadInstance;

				if (typeof filePathOrBuffer === "string") {
					try {
						const fileBuffer = fs.readFileSync(filePathOrBuffer);

						upload = new tus.Upload(fileBuffer, {
							...uploadOptions,
							chunkSize: chunkSize,
						});
					} catch (error) {
						console.error("Error reading file:", error);
						reject(
							new Error(
								`Failed to read file: ${
									error instanceof Error
										? error.message
										: "Unknown error"
								}`
							)
						);
						return;
					}
				} else {
					upload = new tus.Upload(filePathOrBuffer, uploadOptions);
				}

				upload.start();
			});
		} catch (error) {
			console.error(
				"Error setting up tus upload to Cloudflare Stream:",
				error
			);
			throw new Error(
				`Failed to upload video: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	private async getVideoDetails(videoId: string): Promise<VideoDetails> {
		const url = `${this.CLOUDFLARE_TUS_ENDPOINT}/${videoId}`;

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${
						this.CLOUDFLARE_API_TOKEN as string
					}`,
					"Content-Type": "application/json",
				},
			});

			const data = await response.json();

			if (!response.ok) {
				console.error(
					"Failed to get video details from Cloudflare:",
					data
				);
				throw new Error(
					`Failed to get video details: ${
						data.errors?.[0]?.message || "Unknown error"
					}`
				);
			}

			return data.result;
		} catch (error) {
			console.error(
				"Error getting video details from Cloudflare Stream:",
				error
			);
			throw new Error(
				`Failed to get video details: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}
}
