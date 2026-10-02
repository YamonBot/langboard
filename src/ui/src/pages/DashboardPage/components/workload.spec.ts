import { expect, test } from "@playwright/test";
for (const width of [1280, 390]) {
    test(`workload graphs, state links and model updates at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/src/pages/DashboardPage/components/workload.fixture.html");
        await expect(page.getByRole("button", { name: "5 unfinished cards", exact: true, includeHidden: true })).toHaveCount(2);
        const list = page.getByRole("region", { name: "Project list", exact: true });
        await expect(list.getByRole("button", { name: "Ready: 3 unfinished cards", exact: true })).toBeVisible();
        await expect(list.getByRole("button", { name: "Active: 2 unfinished cards", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Done:|Archive:/ })).toHaveCount(0);
        const ready = list.locator("[data-workload-column=ready]");
        const active = list.locator("[data-workload-column=active]");
        await expect(ready).toHaveAttribute("data-workload-max", "9");
        await expect(active).toHaveAttribute("data-workload-max", "7");
        expect(await ready.locator("span").evaluate((element) => Number.parseFloat(element.style.height))).toBeCloseTo(100 / 3);
        expect(await active.locator("span").evaluate((element) => Number.parseFloat(element.style.height))).toBeCloseTo(200 / 7);
        await list.getByRole("button", { name: "Ready: 3 unfinished cards", exact: true }).hover();
        await expect(page.getByRole("tooltip")).toContainText("3/9");
        await list.getByRole("button", { name: "Active: 2 unfinished cards", exact: true }).focus();
        await expect(page.getByRole("tooltip").filter({ hasText: "Active" })).toContainText("2/7");
        await page.keyboard.press("Escape");
        for (const id of ["favorite-title", "explorer-title"]) {
            expect(await page.getByTestId(id).evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(80);
        }
        const favorites = page.getByRole("region", { name: "Favorites", exact: true });
        if (width < 400) {
            await favorites.getByRole("button", { name: "Unfinished by status", exact: true }).press("Enter");
            await page.getByRole("dialog").getByRole("button", { name: "Active: 2 unfinished cards", exact: true }).press("Enter");
            await page.keyboard.press("Escape");
        } else {
            await favorites.getByRole("button", { name: "Active: 2 unfinished cards", exact: true }).press("Enter");
        }
        await expect(page.getByTestId("route")).toContainText("/board/fixture?filters=unfinished%3Ayes%2Ccolumns%3Aactive");
        await page.getByRole("button", { name: "Apply live counts", exact: true }).click();
        await expect(page.getByRole("button", { name: "1 unfinished cards", exact: true, includeHidden: true })).toHaveCount(2);
        await list.getByRole("button", { name: "Ready: 0 unfinished cards", exact: true }).press("Enter");
        await expect(page.getByTestId("route")).toContainText("columns%3Aready");
        expect(await page.locator("button button").count()).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
}
