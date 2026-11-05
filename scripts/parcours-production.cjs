// Parcours client complet contre le site en ligne (inscription, onboarding, import, catégorisation, rapports, isolation).
// Usage : node scripts/parcours-production.cjs <dossier-captures> apps/web/e2e/fixtures/releve-ca.csv
// Les comptes créés (e2e.*@associa-test.fr) sont à supprimer ensuite.
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'https://associa-compta.vercel.app';
const OUT = process.argv[2]; const CSV = process.argv[3];
const run = Date.now();
const users = [
  { email: `e2e.alice.${run}@associa-test.fr`, password: 'Test-parcours-2026-A' },
  { email: `e2e.bob.${run}@associa-test.fr`, password: 'Test-parcours-2026-B' },
];
const step = (m) => console.log('✓', m);
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    // 1. Inscription
    await p.goto(BASE + '/inscription');
    await p.getByLabel('Nom complet').fill('Alice Test');
    await p.getByLabel('Adresse e-mail').fill(users[0].email);
    await p.getByLabel(/Mot de passe/).fill(users[0].password);
    await p.getByRole('button', { name: 'Créer mon compte' }).click();
    await p.waitForURL(/\/onboarding/, { timeout: 30000 });
    step('inscription sans e-mail de confirmation → onboarding');
    // 2. Onboarding
    await p.getByLabel("Nom de l'association").fill(`Club E2E ${run}`);
    await p.getByLabel("Solde au début de l'exercice").fill('1 000,00');
    await p.getByRole('button', { name: 'Créer mon espace' }).click();
    await p.waitForURL(/\/app\/[a-z0-9-]+\?bienvenue=1/, { timeout: 30000 });
    const orgPath = new URL(p.url()).pathname;
    await p.getByText('Trésorerie disponible').waitFor();
    await p.screenshot({ path: path.join(OUT, '1-tableau-de-bord.png') });
    step('association créée, tableau de bord affiché (' + orgPath + ')');
    // 3. Import bancaire
    await p.goto(BASE + orgPath + '/banque?action=importer');
    await p.locator('input[type="file"]').setInputFiles(CSV);
    await p.getByText('4 nouveau(x) mouvement(s)').waitFor({ timeout: 30000 });
    await p.screenshot({ path: path.join(OUT, '2-import.png') });
    await p.getByRole('button', { name: /Importer 4 mouvement/ }).click();
    await p.getByText('4 mouvement(s) importé(s)').waitFor({ timeout: 30000 });
    step('import CSV : 4 mouvements');
    const validate = p.getByRole('button', { name: /Valider les \d+ suggestion/ });
    await validate.waitFor({ timeout: 15000 });
    const label = await validate.textContent();
    await p.screenshot({ path: path.join(OUT, '3-categorisation.png') });
    await validate.click();
    await p.getByText(/mouvement\(s\) comptabilisé\(s\)/).waitFor({ timeout: 30000 });
    step('catégorisation automatique validée : ' + label.trim());
    // 4. Rapports
    await p.goto(BASE + orgPath + '/rapports?onglet=bilan');
    await p.getByText('Équilibré').waitFor({ timeout: 30000 });
    await p.screenshot({ path: path.join(OUT, '4-bilan.png'), fullPage: true });
    step('bilan équilibré');
    await p.goto(BASE + orgPath + '/rapports?onglet=resultat');
    await p.screenshot({ path: path.join(OUT, '5-compte-de-resultat.png'), fullPage: true });
    await p.goto(BASE + orgPath + '/comptabilite?onglet=balance');
    await p.getByText('Équilibrée').waitFor({ timeout: 30000 });
    step('balance équilibrée');
    // 5. Isolation
    const ctx2 = await b.newContext({ locale: 'fr-FR' });
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/inscription');
    await p2.getByLabel('Nom complet').fill('Bob Test');
    await p2.getByLabel('Adresse e-mail').fill(users[1].email);
    await p2.getByLabel(/Mot de passe/).fill(users[1].password);
    await p2.getByRole('button', { name: 'Créer mon compte' }).click();
    await p2.waitForURL(/\/onboarding/, { timeout: 30000 });
    const res = await p2.goto(BASE + orgPath + '/banque');
    console.log(res.status() === 404 ? '✓ isolation : un autre client obtient 404' : '✗ ISOLATION : statut ' + res.status());
  } catch (e) {
    console.log('✗ ÉCHEC :', e.message.split('\n')[0]);
    await p.screenshot({ path: path.join(OUT, 'echec.png'), fullPage: true });
  }
  console.log('erreurs JS :', errors.length ? errors.slice(0, 3) : 'aucune');
  console.log('comptes de test :', users.map((u) => u.email).join(' , '));
  await b.close();
})();
