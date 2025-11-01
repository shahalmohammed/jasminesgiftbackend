import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { signJwt } from "../utils/jwt";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["user", "admin"]).optional().default("user"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const register = async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const { name, email, password, role } = parsed.data;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email already in use" });

  const user = await User.create({ name, email, password, role });

  const token = signJwt({ sub: user.id, role: user.role });
  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  });
};

export const login = async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await user.comparePassword(password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = signJwt({ sub: user.id, role: user.role });
  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  });
};

export const me = async (req: Request & { user?: { id: string } }, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const user = await User.findById(req.user.id).select("-password");
  return res.json({ user });
};
