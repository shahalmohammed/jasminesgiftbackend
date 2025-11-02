"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(["user", "admin"]).optional().default("user"),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const register = async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const { name, email, password, role } = parsed.data;
    const exists = await User_1.User.findOne({ email });
    if (exists)
        return res.status(409).json({ message: "Email already in use" });
    const user = await User_1.User.create({ name, email, password, role });
    const token = (0, jwt_1.signJwt)({ sub: user.id, role: user.role });
    return res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
    });
};
exports.register = register;
const login = async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const { email, password } = parsed.data;
    const user = await User_1.User.findOne({ email });
    if (!user)
        return res.status(401).json({ message: "Invalid credentials" });
    const ok = await user.comparePassword(password);
    if (!ok)
        return res.status(401).json({ message: "Invalid credentials" });
    const token = (0, jwt_1.signJwt)({ sub: user.id, role: user.role });
    return res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
    });
};
exports.login = login;
const me = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const user = await User_1.User.findById(req.user.id).select("-password");
    return res.json({ user });
};
exports.me = me;
