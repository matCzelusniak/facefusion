import Koa from "koa";
import Router from "@koa/router";
import multer from "@koa/multer";
import { FaceFusionController } from "@app/controllers/facefusion-controller";
import bodyParser from "koa-bodyparser";

const app = new Koa();
const router = new Router();
const controller = new FaceFusionController();

const storage = multer.diskStorage({
	destination: (_, file, cb) => {
		if (file.fieldname === "sourceImage") {
			cb(null, "/tmp/input/");
		} else if (file.fieldname === "targetMedia") {
			cb(null, "/tmp/target/");
		} else {
			cb(null, "/tmp/unknown_file_type/");
		}
	},
	filename: (_, file, cb) => {
		const timestamp = Date.now();
		const uniqueSuffix = Math.round(Math.random() * 1e9);
		cb(null, timestamp + "-" + uniqueSuffix + "-" + file.originalname);
	},
});

const upload = multer({ storage });

app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

router.post(
	"/ff/process",
	upload.fields([
		{ name: "sourceImage", maxCount: 1 },
		{ name: "targetMedia", maxCount: 1 },
	]),
	controller.process
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
