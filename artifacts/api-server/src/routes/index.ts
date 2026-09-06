import { Router, type IRouter } from "express";
import healthRouter from "./health";
import childledRouter from "./childled";

const router: IRouter = Router();

router.use(healthRouter);
router.use(childledRouter);

export default router;
