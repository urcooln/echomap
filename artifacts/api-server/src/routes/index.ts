import { Router, type IRouter } from "express";
import healthRouter from "./health";
import childledRouter from "./childled";
import { requireChildLedApiActor } from "../lib/api-authorization-middleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireChildLedApiActor);
router.use(childledRouter);

export default router;
