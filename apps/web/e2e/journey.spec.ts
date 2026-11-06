import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, service, { auth: { persistSession: false } });
const run = Date.now();
const alice = { email: `alice+${run}@e2e.associa-compta.fr`, password: "Motdepasse-tres-sur-1" };
const bob = { email: `bob+${run}@e2e.associa-compta.fr`, password: "Motdepasse-tres-sur-2" };
let orgPath = "";

async function login(page: Page, u: typeof alice) {
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByLabel("Adresse e-mail").fill(u.email);
  await page.getByLabel(/Mot de passe/).fill(u.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"));
}

test.beforeAll(async () => {
  for (const u of [alice, bob]) {
    const { error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
  }
});

test.describe.serial("parcours trésorier", () => {
  test("onboarding : création de l'association", async ({ page }) => {
    await login(page, alice);
    await page.waitForURL(/\/onboarding/);
    await page.getByLabel("Nom de l'association").fill(`Les Amis E2E ${run}`);
    await page.getByLabel("Solde au début de l'exercice").fill("1 000,00");
    await page.getByRole("button", { name: "Créer mon espace" }).click();
    await page.waitForURL(/\/app\/[a-z0-9-]+\?bienvenue=1/);
    orgPath = new URL(page.url()).pathname;
    await expect(page.getByText("Trésorerie disponible")).toBeVisible();
    await expect(page.getByText("1 000,00 €").first()).toBeVisible();
  });

  test("banque : import CSV, suggestions et comptabilisation", async ({ page }) => {
    await login(page, alice);
    await page.goto(`${orgPath}/banque?action=importer`);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/releve-ca.csv"));
    await expect(page.getByText("4 nouveau(x) mouvement(s)")).toBeVisible();
    await page.getByRole("button", { name: /Importer 4 mouvement/ }).click();
    await expect(page.getByText("4 mouvement(s) importé(s)")).toBeVisible();
    // Les catégories standards sont proposées (assurance, petit matériel, subvention commune)
    await page.getByRole("button", { name: /Valider les \d+ suggestion/ }).click();
    await expect(page.getByText(/mouvement\(s\) comptabilisé\(s\)/)).toBeVisible();

    // Ré-import : 100 % doublons
    await page.goto(`${orgPath}/banque?action=importer`);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/releve-ca.csv"));
    await expect(page.getByText("4 déjà importé(s)")).toBeVisible();
  });

  test("rapports : compte de résultat et bilan équilibré", async ({ page }) => {
    await login(page, alice);
    await page.goto(`${orgPath}/rapports?onglet=bilan`);
    await expect(page.getByText("Équilibré")).toBeVisible();
    await page.goto(`${orgPath}/comptabilite?onglet=balance`);
    await expect(page.getByText("Équilibrée")).toBeVisible();
  });

  test("isolation : un autre utilisateur n'accède pas à l'association", async ({ page }) => {
    await login(page, bob);
    await page.waitForURL(/\/onboarding/);
    const res = await page.goto(`${orgPath}/banque`);
    expect(res?.status()).toBe(404);
  });
});
