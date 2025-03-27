import config from "../utils/config";
const fetch = require("node-fetch");
const FormData = require("form-data");
const tus = require("tus-js-client");
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
		fileBuffer: Buffer,
		jobId: string
	): Promise<{ id: string; url: string }> {
		const filename = `${jobId}.webp`;
		const url = this.CLOUDFLARE_IMAGES_ENDPOINT.replace(
			"{account_id}",
			this.CLOUDFLARE_ACCOUNT_ID
		);

		try {
			console.log("Uploading image to Cloudflare Images...");

			const form = new FormData();

			form.append("file", fileBuffer, {
				filename,
				contentType: "image/webp",
			});

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
		fileBuffer: Buffer,
		jobId: string,
		extensionOrOptions:
			| string
			| { fileType?: string; maxDurationSeconds?: number } = ".mp4"
	): Promise<{ id: string; url: string }> {
		let extension = ".mp4";
		let maxDurationSeconds = "86400";

		if (typeof extensionOrOptions === "string") {
			extension = extensionOrOptions;
		} else if (
			extensionOrOptions &&
			typeof extensionOrOptions === "object"
		) {
			if (extensionOrOptions.fileType) {
				extension = extensionOrOptions.fileType;
			}
			if (extensionOrOptions.maxDurationSeconds) {
				maxDurationSeconds =
					extensionOrOptions.maxDurationSeconds.toString();
			}
		}

		const filename = `${jobId}${extension}`;
		const contentType = extension === ".mp4" ? "video/mp4" : "video/webm";

		try {
			console.log(
				"Uploading video to Cloudflare Stream using tus protocol..."
			);

			return new Promise((resolve, reject) => {
				const upload = new tus.Upload(fileBuffer, {
					endpoint: this.CLOUDFLARE_TUS_ENDPOINT,
					headers: {
						Authorization: `Bearer ${
							this.CLOUDFLARE_API_TOKEN as string
						}`,
					},
					metadata: {
						filename,
						filetype: contentType,
						maxDurationSeconds,
					},

					onSuccess: async () => {
						try {
							const uploadUrl = upload.url;
							const videoId = uploadUrl.split("/").pop();

							console.log(
								"Video uploaded, waiting for processing..."
							);

							const videoDetails = await this.getVideoDetails(
								videoId
							);

							resolve({
								id: videoId,
								url: videoDetails.playback.hls,
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
				});

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

	private async getVideoDetails(videoId: string): Promise<any> {
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
