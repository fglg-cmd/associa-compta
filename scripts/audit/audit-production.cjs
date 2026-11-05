// Audit complet du site en ligne (≈ 75 contrôles : modules, exports, mobile, isolation, sécurité).
// Usage : node scripts/audit/audit-production.cjs scripts/audit
// Crée des comptes e2e.*@associa-test.fr à supprimer ensuite (voir docs/06-AUDIT.md).
// Audit complet du site en production : chaque module, chaque page, ordinateur + mobile.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'https://associa-compta.vercel.app';
const DIR = process.argv[2];
const run = Date.now();
const A = { email: `e2e.audit.${run}@associa-test.fr`, password: 'Audit-complet-2026-A' };
const B = { email: `e2e.intrus.${run}@associa-test.fr`, password: 'Audit-complet-2026-B' };
const results = []; const issues = [];
const ok = (m) => { results.push('✓ ' + m); console.log('✓', m); };
const ko = (m) => { results.push('✗ ' + m); issues.push(m); console.log('✗', m); };
async function step(name, fn) { try { await fn(); ok(name); } catch (e) { ko(`${name} — ${e.message.split('\n')[0].slice(0, 220)}`); } }

async function signup(page, u, name) {
  await page.goto(BASE + '/inscription');
  await page.getByLabel('Nom complet').fill(name);
  await page.getByLabel('Adresse e-mail').fill(u.email);
  await page.getByLabel(/Mot de passe/).fill(u.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30000 });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const p = await ctx.newPage();
  const jsErrors = []; const serverErrors = [];
  p.on('pageerror', (e) => jsErrors.push(`${p.url()} : ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|posthog|sentry/i.test(m.text())) jsErrors.push(`${p.url()} : ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`); });
  let org = '';
  const toast = (re) => p.locator('[data-sonner-toast]').filter({ hasText: re }).first().waitFor({ timeout: 30000 });

  await step('Inscription + onboarding', async () => {
    await signup(p, A, 'Audit Trésorier');
    await p.getByLabel("Nom de l'association").fill(`Audit ${run}`);
    await p.getByLabel("Solde au début de l'exercice").fill('2 000,00');
    await p.getByRole('button', { name: 'Créer mon espace' }).click();
    await p.waitForURL(/\/app\/[a-z0-9-]+\?bienvenue=1/, { timeout: 30000 });
    org = new URL(p.url()).pathname;
  });

  await step('Banque : import + suggestions + comptabilisation', async () => {
    await p.goto(BASE + org + '/banque?action=importer');
    await p.locator('input[type="file"]').setInputFiles(path.join(DIR, 'releve.csv'));
    await p.getByRole('button', { name: /Importer 4 mouvement/ }).click();
    await toast(/importé/);
    await p.getByRole('button', { name: /Valider les 4 suggestion/ }).click();
    await toast(/comptabilisé/);
  });
  await step('Banque : réimport = 100 % doublons', async () => {
    await p.goto(BASE + org + '/banque?action=importer');
    await p.locator('input[type="file"]').setInputFiles(path.join(DIR, 'releve.csv'));
    await p.getByText('4 déjà importé(s)').waitFor({ timeout: 30000 });
    await p.keyboard.press('Escape');
  });
  await step('Banque : annuler une comptabilisation (contre-passation)', async () => {
    await p.goto(BASE + org + '/banque?vue=done');
    await p.getByRole('button', { name: 'Annuler' }).first().click();
    await toast(/annulée/);
  });
  await step('Banque : page des règles apprises', async () => {
    await p.goto(BASE + org + '/banque/regles');
    await p.getByText(/utilisation\(s\)/).first().waitFor({ timeout: 15000 });
  });

  await step('Opérations : dépense en espèces', async () => {
    await p.goto(BASE + org + '/operations?action=nouvelle');
    await p.getByLabel('Libellé').fill('Achat de ballons');
    await p.getByLabel('Montant').fill('20,00');
    await p.locator('select[name="paymentAccountId"]').selectOption({ label: 'Caisse (espèces)' });
    const cat = p.locator('form select').filter({ hasText: 'Choisir une catégorie' }).first();
    await cat.selectOption({ label: 'Fournitures et petit matériel' });
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await toast(/Dépense enregistrée/);
  });

  await step('Justificatifs : envoi PDF + lecture automatique (OCR)', async () => {
    await p.goto(BASE + org + '/justificatifs?action=ajouter');
    await p.locator('input[type="file"]').setInputFiles(path.join(DIR, 'facture-leroy.pdf'));
    await p.getByRole('button', { name: 'Envoyer' }).click();
    await p.getByText(/45,90/).first().waitFor({ timeout: 60000 });
    await p.keyboard.press('Escape');
  });
  await step('Justificatifs : recherche plein texte « leroy »', async () => {
    await p.goto(BASE + org + '/justificatifs?q=leroy');
    await p.getByText('facture-leroy.pdf').first().waitFor({ timeout: 15000 });
  });
  await step('Justificatifs : aperçu du document', async () => {
    await p.getByText('facture-leroy.pdf').first().click();
    await p.locator('iframe[title="facture-leroy.pdf"]').waitFor({ timeout: 20000 });
    await p.keyboard.press('Escape');
  });

  await step('Adhérents : import CSV', async () => {
    await p.goto(BASE + org + '/adherents');
    await p.getByRole('button', { name: 'Importer' }).click();
    await p.locator('input[type="file"][name="file"]').setInputFiles(path.join(DIR, 'adherents.csv'));
    await p.getByRole('dialog').getByRole('button', { name: 'Importer' }).click();
    await toast(/2 adhérent\(s\) importé/);
  });
  await step('Adhérents : fiche + cotisation + encaissement espèces', async () => {
    await p.goto(BASE + org + '/adherents');
    await p.getByRole('link', { name: /MARTIN Marie/ }).click();
    await p.getByRole('button', { name: 'Cotisation', exact: true }).click();
    await p.getByRole('dialog').getByLabel('Montant', { exact: true }).fill('30,00');
    await p.getByRole('dialog').getByRole('button', { name: 'Créer' }).click();
    await toast(/Cotisation créée/);
    await p.getByRole('button', { name: 'Encaisser' }).click();
    await p.getByRole('dialog').locator('select').first().selectOption('cash');
    await p.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await toast(/Paiement enregistré/);
    await p.getByText('Payée').first().waitFor({ timeout: 15000 });
  });

  await step('Projets : création d\'un événement + ligne budgétaire', async () => {
    await p.goto(BASE + org + '/projets?action=creer');
    await p.getByLabel('Nom').fill('Kermesse audit');
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await p.waitForURL(/\/projets\/[0-9a-f-]+/, { timeout: 30000 });
    await p.getByPlaceholder('Location de salle').fill('Location de salle');
    await p.getByPlaceholder('0,00 €').fill('150');
    await p.getByRole('button', { name: 'Ajouter' }).click();
    await p.getByText('150,00 €').first().waitFor({ timeout: 15000 });
  });

  for (const tab of ['balance', 'grand-livre', 'journaux', 'plan', 'exercices']) {
    await step(`Comptabilité : onglet ${tab}`, async () => {
      const r = await p.goto(BASE + org + '/comptabilite?onglet=' + tab);
      if (r.status() !== 200) throw new Error('HTTP ' + r.status());
    });
  }
  await step('Comptabilité : balance équilibrée', async () => {
    await p.goto(BASE + org + '/comptabilite?onglet=balance');
    await p.getByText('Équilibrée').waitFor({ timeout: 15000 });
  });
  for (const tab of ['resultat', 'bilan', 'ag', 'exports']) {
    await step(`Rapports : onglet ${tab}`, async () => {
      const r = await p.goto(BASE + org + '/rapports?onglet=' + tab);
      if (r.status() !== 200) throw new Error('HTTP ' + r.status());
    });
  }
  await step('Rapports : bilan équilibré', async () => {
    await p.goto(BASE + org + '/rapports?onglet=bilan');
    await p.getByText('Équilibré', { exact: true }).waitFor({ timeout: 15000 });
  });

  // Exports : téléchargement réel et contrôle du type de fichier
  const exportLinks = await p.goto(BASE + org + '/rapports?onglet=exports').then(() => p.locator('a[href*="/api/exports/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))));
  // Téléchargement depuis le navigateur (mêmes cookies, même réseau que l'utilisateur)
  const fetchIn = (page, href) => page.evaluate(async (h) => {
    const r = await fetch(h, { redirect: 'manual' });
    const isText = /text|csv/.test(r.headers.get('content-type') || '');
    const buf = r.type === 'opaqueredirect' ? new ArrayBuffer(0) : await r.arrayBuffer();
    return { status: r.type === 'opaqueredirect' ? 303 : r.status, ct: r.headers.get('content-type') || '', size: buf.byteLength,
      text: isText ? new TextDecoder().decode(buf).slice(0, 4000) : '' };
  }, href);
  for (const href of exportLinks) {
    const r = await fetchIn(p, href);
    const label = href.replace(/.*rapport=([^&]+)&format=([^&]+).*/, '$1.$2');
    if (r.status === 200 && r.size > 50) ok(`Export ${label} (${r.ct.split(';')[0]}, ${r.size} octets)`);
    else if (r.status === 303) ok(`Export ${label} réservé à l'offre Essentiel (redirection abonnement)`);
    else ko(`Export ${label} — HTTP ${r.status} ${r.size} octets`);
    if (label === 'fec.txt' && r.status === 200) {
      const lines = r.text.trim().split(/\r?\n/);
      lines[0].split('\t').length === 18 ? ok(`FEC : 18 colonnes réglementaires, ${lines.length - 1} lignes d'écritures`) : ko('FEC : en-tête invalide');
    }
  }

  for (const tab of ['association', 'equipe', 'abonnement', 'support', 'danger']) {
    await step(`Paramètres : onglet ${tab}`, async () => {
      const r = await p.goto(BASE + org + '/parametres?onglet=' + tab);
      if (r.status() !== 200) throw new Error('HTTP ' + r.status());
    });
  }
  await step('Paramètres : invitation d\'un membre du bureau (lien)', async () => {
    await p.goto(BASE + org + '/parametres?onglet=equipe');
    await p.getByPlaceholder('tresorier.adjoint@monasso.fr').fill(`e2e.invite.${run}@associa-test.fr`);
    await p.getByRole('button', { name: 'Inviter' }).click();
    await p.getByText('/invitation/').first().waitFor({ timeout: 20000 });
  });
  await step('Paramètres : message au support', async () => {
    await p.goto(BASE + org + '/parametres?onglet=support');
    await p.locator('input[name="subject"]').fill('Test audit automatique');
    await p.locator('textarea[name="message"]').fill('Message de test envoyé par l\'audit automatique.');
    await p.getByRole('button', { name: 'Envoyer' }).click();
    await toast(/Message envoyé/);
  });
  await step('Recherche ⌘K : trouver « Martin »', async () => {
    await p.goto(BASE + org);
    await p.keyboard.press('Control+k');
    await p.getByPlaceholder(/Rechercher un adhérent/).fill('Martin');
    await p.getByRole('option', { name: /Marie Martin/ }).first().waitFor({ timeout: 15000 });
    await p.keyboard.press('Escape');
  });

  // Mobile : pages sans débordement horizontal
  const m = await b.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const route of ['', '/banque', '/operations', '/justificatifs', '/adherents', '/projets', '/comptabilite', '/rapports', '/parametres']) {
    await mp.goto(BASE + org + route);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    over > 2 ? ko(`Mobile ${route || '/'} : débordement horizontal de ${over}px`) : ok(`Mobile ${route || '/'} : affichage correct`);
    if (route === '' || route === '/banque') await mp.screenshot({ path: path.join(DIR, `mobile${route.replace('/', '-') || '-accueil'}.png`) });
  }
  for (const pub of ['/', '/tarifs', '/connexion', '/inscription', '/cgu']) {
    await mp.goto(BASE + pub);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    over > 2 ? ko(`Mobile public ${pub} : débordement de ${over}px`) : ok(`Mobile public ${pub} : affichage correct`);
  }

  // Sécurité : un autre client ne doit rien voir
  const ctxB = await b.newContext({ locale: 'fr-FR' });
  const pb = await ctxB.newPage();
  await step('Isolation : second client inscrit', async () => signup(pb, B, 'Intrus'));
  for (const route of ['', '/banque', '/adherents', '/justificatifs', '/rapports']) {
    const r = await pb.goto(BASE + org + route);
    r.status() === 404 ? ok(`Isolation ${route || '/'} : 404 pour un autre client`) : ko(`ISOLATION ${route || '/'} : HTTP ${r.status()}`);
  }
  const exp = await fetchIn(pb, exportLinks.find((h) => h.includes('fec')));
  [403, 307, 303].includes(exp.status) ? ok(`Isolation export FEC : refusé (HTTP ${exp.status})`) : ko(`ISOLATION export FEC : HTTP ${exp.status} (${exp.size} octets)`);
  const adm = await pb.goto(BASE + '/admin');
  adm.status() === 404 ? ok('Back-office inaccessible à un client (404)') : ko(`Back-office accessible : HTTP ${adm.status()}`);
  const anonPage = await (await b.newContext()).newPage();
  await anonPage.goto(BASE + '/tarifs');
  const anon = await fetchIn(anonPage, exportLinks[0]);
  [307, 303, 401, 403].includes(anon.status) ? ok(`Export sans connexion : refusé (HTTP ${anon.status})`) : ko(`Export sans connexion : HTTP ${anon.status} (${anon.size} octets)`);

  await step('Déconnexion', async () => {
    await p.goto(BASE + org);
    await p.getByText('Audit Trésorier').last().click();
    await p.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await p.waitForURL(/\/connexion/, { timeout: 20000 });
  });

  console.log('\nErreurs JavaScript :', jsErrors.length ? [...new Set(jsErrors)].slice(0, 10) : 'aucune');
  console.log('Erreurs serveur (5xx) :', serverErrors.length ? [...new Set(serverErrors)].slice(0, 10) : 'aucune');
  console.log(`\nBILAN : ${results.filter((r) => r.startsWith('✓')).length} OK, ${issues.length} problème(s)`);
  fs.writeFileSync(path.join(DIR, 'comptes.txt'), [A.email, B.email].join('\n'));
  await b.close();
})();
