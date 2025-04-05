"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const dbconfig_1 = __importDefault(require("./config/dbconfig"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const cors = require("cors");
app.use(cors());
const PORT = process.env.PORT || 5000;
app.use(express_1.default.json());
(0, dbconfig_1.default)();
app.use("/", auth_routes_1.default);
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
