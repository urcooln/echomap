import { Router, type IRouter } from "express";
import healthRouter from "./health";
import echomapRouter from "./echomap";

const router: IRouter = Router();

router.use(healthRouter);
router.use(echomapRouter);

export default router;
