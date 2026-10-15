import { handle } from "hono/vercel";
import { app } from "@/server/api";

const handler = handle(app);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
