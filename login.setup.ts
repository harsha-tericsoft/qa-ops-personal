// login.spec.js

// import { test } from "../fixtures";
// tasks.spec.ts

// login.setup.ts

// import { STORAGE_STATE } from "./playwright.config"; // STORAGE_STATE = "./auth/session.json"
// import { test } from "../fixtures";

// test.describe("Login page", () => {
//     test("should login with the correct credentials", async ({
//         page,
//         loginPage,
//     }) => {
//         await page.goto("http://localhost:3000");
//         await loginPage.loginAndVerifyUser({
//             email: "oliver@example.com",
//             password: "welcome",
//             username: "Oliver Smith",
//         });
//         await page.context().storageState({ path: STORAGE_STATE });
//     });
// });

import { STORAGE_STATE } from "./playwright.config";
import { test } from "../fixtures";

test("authenticate user and save session", async ({ page, loginPage }) => {
  await page.goto("/");

  await loginPage.loginAndVerifyUser({
    email: "oliver@example.com",
    password: "welcome",
    username: "Oliver Smith",
  });

  await page.context().storageState({ path: STORAGE_STATE });
});
