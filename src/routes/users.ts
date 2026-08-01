import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";

export const usersRouter = Router();

type IdParams = { id: string };

// Express 5 forwards rejected promises to the error handler automatically,
// so these handlers don't need their own try/catch.

usersRouter.get("/", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users);
});

usersRouter.get("/:id", async (req: Request<IdParams>, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

usersRouter.post("/", async (req: Request, res: Response) => {
  const { email, name } = req.body ?? {};

  if (typeof email !== "string" || email.length === 0) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const user = await prisma.user.create({
    data: { email, name: typeof name === "string" ? name : null },
  });

  res.status(201).json(user);
});

usersRouter.delete("/:id", async (req: Request<IdParams>, res: Response) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
