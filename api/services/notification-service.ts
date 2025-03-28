import config from "../utils/config";
import { INotificationData } from "@app/types/facefusion.types";
const fetch = require("node-fetch");

export interface NotificationPayload {
	jobId: string;
	status: "SUCCESS" | "FAIL";
}

export class NotificationService {
	public readonly CALLBACK_URL: string;

	constructor() {
		this.CALLBACK_URL = config.CALLBACK_URL;
	}

	public async sendNotification(data: INotificationData): Promise<void> {
		try {
			const response = await fetch(this.CALLBACK_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			if (!response.ok) {
				console.log(response);
				console.error(
					`Notification failed with status ${response.status}`
				);
			}
		} catch (error) {
			console.error("Failed to send notification:", error);
		}
	}

	public async sendStatusUpdate(
		endpoint: string,
		jobId: string,
		status: "SUCCESS" | "FAIL"
	): Promise<void> {
		if (!endpoint) {
			console.log("No endpoint configured, skipping status update");
			return;
		}

		const payload: NotificationPayload = {
			jobId,
			status,
		};

		console.log("sendStatusUpdate::payload", payload);

		try {
			const response = await fetch(endpoint, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				console.log(response);
				console.error(
					`Status update failed with status ${response.status}`
				);
			} else {
				console.log(`Status update for job ${jobId} sent successfully`);
			}
		} catch (error) {
			console.log(error);
			console.error("Failed to send status update:", error);
		}
	}
}
