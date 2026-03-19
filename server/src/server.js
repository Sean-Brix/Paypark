import dotenv from "dotenv";
import { app } from "./app.js";

dotenv.config();

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Paypark API listening on http://localhost:${port}`);
});
