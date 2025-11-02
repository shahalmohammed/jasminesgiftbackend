"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (_req, res) => res.send("Auth API is running"));
app.use("/api/auth", auth_routes_1.default);
app.use("/api/products", product_routes_1.default);
app.use((0, cors_1.default)({
    origin: ["http://localhost:5173", "http://localhost:8080"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
(0, db_1.connectDB)().then(() => {
    app.listen(Number(env_1.env.PORT), () => {
        console.log(`🚀 Server http://localhost:${env_1.env.PORT}`);
    });
});
