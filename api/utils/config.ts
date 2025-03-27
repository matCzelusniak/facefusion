import "dotenv/config";

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
	throw new Error("CLOUDFLARE_ACCOUNT_ID is not set in the environment.");
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
	throw new Error("CLOUDFLARE_API_TOKEN is not set in the environment.");
}

if (!process.env.CALLBACK_URL) {
	throw new Error("CALLBACK_URL is not set in the environment.");
}

const config = {
	CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
	CALLBACK_URL: process.env.CALLBACK_URL,
};

export default config;
