import { Router } from "express";
import { paginationMeta } from "../../core/pagination.js";
import { toUserResponse } from "./users.mapper.js";
import * as usersService from "./users.service.js";
import {
  createUserBody,
  listUsersQuery,
  updateUserBody,
  updateUserStatusBody,
  userIdParams,
} from "./users.schema.js";

/**
 * Admin-facing user endpoints, mounted at /api/v1/admin/users.
 *
 * Permissions are never checked here. When auth is added it goes on the
 * /admin group in api/index.ts, and this file stays exactly as it is.
 *
 * Express 5 forwards rejected promises to the error handler, so async
 * handlers need no try/catch: throw, or let a Zod/Prisma error bubble up.
 */
export const adminUsersRoutes = Router();

/** GET /api/v1/admin/users - paginated, filterable list. */
adminUsersRoutes.get("/", async (req, res) => {
  const query = listUsersQuery.parse(req.query);
  const { users, total } = await usersService.listUsers(query);

  res.json({
    data: users.map(toUserResponse),
    meta: paginationMeta(query, total),
  });
});

/** GET /api/v1/admin/users/:id */
adminUsersRoutes.get("/:id", async (req, res) => {
  const { id } = userIdParams.parse(req.params);
  const user = await usersService.getUserById(id);

  res.json({ data: toUserResponse(user) });
});

/** POST /api/v1/admin/users */
adminUsersRoutes.post("/", async (req, res) => {
  const body = createUserBody.parse(req.body);
  const user = await usersService.createUser(body);

  res.status(201).json({ data: toUserResponse(user) });
});

/** PATCH /api/v1/admin/users/:id - profile fields only. */
adminUsersRoutes.patch("/:id", async (req, res) => {
  const { id } = userIdParams.parse(req.params);
  const body = updateUserBody.parse(req.body);
  const user = await usersService.updateUser(id, body);

  res.json({ data: toUserResponse(user) });
});

/** PATCH /api/v1/admin/users/:id/status - activate, block or suspend. */
adminUsersRoutes.patch("/:id/status", async (req, res) => {
  const { id } = userIdParams.parse(req.params);
  const { status } = updateUserStatusBody.parse(req.body);
  const user = await usersService.setUserStatus(id, status);

  res.json({ data: toUserResponse(user) });
});

/** DELETE /api/v1/admin/users/:id - soft delete, the row is kept. */
adminUsersRoutes.delete("/:id", async (req, res) => {
  const { id } = userIdParams.parse(req.params);
  await usersService.softDeleteUser(id);

  res.status(204).end();
});
