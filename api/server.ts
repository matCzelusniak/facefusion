import Koa from "koa";
import Router from "@koa/router";
import multer from "@koa/multer";
import { FaceFusionController } from "@app/controllers/facefusion-controller";

const app = new Koa();
const router = new Router();
const controller = new FaceFusionController();

const upload = multer({ dest: "uploads/" });

router.post(
	"/ff/process",
	upload.fields([
		{ name: "sourceImage", maxCount: 1 },
		{ name: "targetMedia", maxCount: 1 },
	]),
	controller.process
);

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
