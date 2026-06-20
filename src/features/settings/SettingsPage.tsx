import { BadgeCheck, Download, FileText, KeyRound, Lock, Plus, RotateCcw, ShieldCheck, Smartphone, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { HelpModalButton } from "../../components/finance/HelpModal";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/AppState";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import {
  addCategory,
  addSubcategory,
  archiveCategory,
  archiveSubcategory,
  editCategory,
  editSubcategory,
  listCategories,
  listSubcategories,
  restoreCategory,
  restoreSubcategory,
  seedDefaultExpenseCategories
} from "../../db/repositories/categoryRepository";
import { seedDefaultAccounts } from "../../db/repositories/accountRepository";
import { activateLicense, clearLicense, getLicenseStatus } from "../../db/repositories/licenseRepository";
import { setAppSetting } from "../../db/repositories/settingsRepository";
import type { Category, Subcategory } from "../../db/schema";
import { canUseFeature, featureLabels, getTierLimit, tierDefinitions, type CommercialTier, type FeatureKey } from "../../lib/commercialTiers";
import type { LicenseStatus } from "../../lib/license";
import { createPlannerBackup, downloadJsonBackup, parsePlannerBackup, resetPlannerData, restorePlannerBackup } from "../../lib/dataPortability";
import { createEncryptedPlannerBackup, decryptPlannerBackup, downloadEncryptedBackup } from "../../lib/encryptedBackup";
import { buildProfessionalReportPdfBlob } from "../../lib/financialReport";
import { useAppStore } from "../../stores/appStore";

const commercialFeatures: FeatureKey[] = [
  "basic_dashboard",
  "simple_analytics",
  "transaction_tracker",
  "multi_account",
  "monthly_budgeting",
  "advanced_analytics",
  "savings_goals",
  "debt_tracker",
  "recurring_transactions",
  "export_features",
  "net_worth_tracking",
  "smart_insights",
  "advanced_forecasting",
  "investment_tracker",
  "retirement_simulation",
  "premium_reports",
  "advanced_financial_scoring"
];

export function SettingsPage() {
  const backupInputRef = useRef<HTMLInputElement>(null);
  const encryptedBackupInputRef = useRef<HTMLInputElement>(null);
  const tier = useAppStore((state) => state.commercialTier);
  const setTier = useAppStore((state) => state.setCommercialTier);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setHasCompletedOnboarding = useAppStore((state) => state.setHasCompletedOnboarding);
  const installPromptAvailable = useAppStore((state) => state.installPromptAvailable);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | undefined>();
  const [encryptedBackupPassphrase, setEncryptedBackupPassphrase] = useState("");
  const [encryptedRestorePassphrase, setEncryptedRestorePassphrase] = useState("");
  const [encryptedRestoreFile, setEncryptedRestoreFile] = useState<File | undefined>();
  const [isEncryptedBackupOpen, setEncryptedBackupOpen] = useState(false);
  const [isEncryptedRestoreOpen, setEncryptedRestoreOpen] = useState(false);
  const [isResetDataOpen, setResetDataOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetBackupAcknowledged, setResetBackupAcknowledged] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | undefined>();
  const [activeSubcategory, setActiveSubcategory] = useState<Subcategory | undefined>();
  const [isCategoryFormOpen, setCategoryFormOpen] = useState(false);
  const [isSubcategoryFormOpen, setSubcategoryFormOpen] = useState(false);
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [showArchivedSubcategories, setShowArchivedSubcategories] = useState(false);
  const canExportPdfReport = canUseFeature(tier, "premium_reports");

  async function loadManagementData() {
    const [nextCategories, nextSubcategories] = await Promise.all([
      listCategories(showArchivedCategories),
      listSubcategories(showArchivedSubcategories)
    ]);
    setCategories(nextCategories);
    setSubcategories(nextSubcategories);
  }

  useEffect(() => {
    void loadManagementData();
  }, [showArchivedCategories, showArchivedSubcategories]);

  useEffect(() => {
    void getLicenseStatus().then(setLicenseStatus);
  }, []);

  async function handleLicenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    try {
      const license = await activateLicense(licenseKey);
      setLicenseStatus(license);
      setTier(license.tier);
      setLicenseKey("");
      setStatusMessage(`Lisensi ${tierDefinitions[license.tier].name} aktif di perangkat ini.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Kode lisensi tidak valid.");
    }
  }

  async function handleClearLicense() {
    await clearLicense();
    setLicenseStatus(undefined);
    setTier("inactive");
    setStatusMessage("Lisensi lokal dihapus. Aktivasi BASIC gratis diperlukan untuk memakai data finansial real.");
  }

  async function handleTheme(nextTheme: "light" | "warm") {
    setTheme(nextTheme);
    await setAppSetting("theme", nextTheme);
  }

  async function handleBackupDownload() {
    setErrorMessage("");
    const backup = await createPlannerBackup();
    downloadJsonBackup(backup);
      setStatusMessage("Backup DANAPETA berhasil diunduh. Simpan file ini di lokasi yang aman.");
  }

  async function handleRestore(file: File) {
    setErrorMessage("");
    try {
      const backup = parsePlannerBackup(await file.text());
      await restorePlannerBackup(backup);
      setStatusMessage(`Backup dari ${new Date(backup.exportedAt).toLocaleString("id-ID")} berhasil dipulihkan. Muat ulang aplikasi agar semua state lokal segar kembali.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to restore this backup.");
    }
  }

  async function handleEncryptedBackupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    try {
      const { backup, blob } = await createEncryptedPlannerBackup(encryptedBackupPassphrase);
      downloadEncryptedBackup(blob, backup.exportedAt);
      setEncryptedBackupOpen(false);
      setEncryptedBackupPassphrase("");
      setStatusMessage("Backup terenkripsi berhasil diunduh. Simpan file .danapeta ini di Google Drive atau penyimpanan pribadi Anda.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Backup terenkripsi gagal dibuat.");
    }
  }

  async function handleEncryptedRestoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (!encryptedRestoreFile) {
      setErrorMessage("Pilih file backup terenkripsi terlebih dahulu.");
      return;
    }
    try {
      const backup = await decryptPlannerBackup(await encryptedRestoreFile.text(), encryptedRestorePassphrase);
      await restorePlannerBackup(backup);
      setEncryptedRestoreOpen(false);
      setEncryptedRestoreFile(undefined);
      setEncryptedRestorePassphrase("");
      setStatusMessage(`Backup terenkripsi dari ${new Date(backup.exportedAt).toLocaleString("id-ID")} berhasil dipulihkan. Lisensi perangkat ini tetap dipertahankan.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Backup terenkripsi gagal dipulihkan.");
    }
  }

  async function handlePdfExport() {
    setErrorMessage("");
    if (!canExportPdfReport) {
      setErrorMessage("Laporan PDF tersedia di tier ELITE karena memakai insight dan rekomendasi pengelola keuangan.");
      return;
    }
    const backup = await createPlannerBackup();
    const blob = buildProfessionalReportPdfBlob(backup, tier);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `danapeta-laporan-keuangan-${backup.exportedAt.slice(0, 10)}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Laporan PDF DANAPETA berhasil diunduh.");
  }

  async function resetOnboarding() {
    await setAppSetting("hasCompletedOnboarding", false);
    setHasCompletedOnboarding(false);
  }

  async function handleResetData() {
    if (resetConfirmText !== "RESET DANAPETA" || !resetBackupAcknowledged) return;
    setErrorMessage("");
    await resetPlannerData();
    await seedDefaultAccounts();
    await seedDefaultExpenseCategories();
    setResetDataOpen(false);
    setResetConfirmText("");
    setResetBackupAcknowledged(false);
    await loadManagementData();
    setStatusMessage("Data finansial lokal sudah direset. Template akun, kategori, dan subkategori standar sudah dibuat ulang. Lisensi, device identity, dan tema tetap dipertahankan.");
  }

  async function handleApplyCategoryTemplate() {
    setErrorMessage("");
    await seedDefaultExpenseCategories();
    await loadManagementData();
    setStatusMessage("Template kategori dan subkategori standar sudah diterapkan. Kategori yang sudah ada tidak diduplikasi.");
  }

  async function installApp() {
    const prompt = window.danapetaInstallPrompt;
    if (prompt) {
      await prompt.prompt();
      return;
    }
    setStatusMessage("Gunakan menu browser lalu pilih Install app atau Add to Home Screen saat tersedia.");
  }

  function openCategoryForm(category?: Category) {
    setActiveCategory(category);
    setCategoryFormOpen(true);
  }

  function closeCategoryForm() {
    setActiveCategory(undefined);
    setCategoryFormOpen(false);
  }

  async function handleCategorySubmit(values: CategoryFormValues) {
    if (activeCategory) {
      await editCategory(activeCategory.id, values);
    } else {
      await addCategory(values);
    }
    closeCategoryForm();
    await loadManagementData();
  }

  async function handleArchiveCategory(category: Category) {
    await archiveCategory(category.id);
    await loadManagementData();
  }

  async function handleRestoreCategory(category: Category) {
    await restoreCategory(category.id);
    await loadManagementData();
  }

  function openSubcategoryForm(subcategory?: Subcategory) {
    setActiveSubcategory(subcategory);
    setSubcategoryFormOpen(true);
  }

  function closeSubcategoryForm() {
    setActiveSubcategory(undefined);
    setSubcategoryFormOpen(false);
  }

  async function handleSubcategorySubmit(values: SubcategoryFormValues) {
    if (activeSubcategory) {
      await editSubcategory(activeSubcategory.id, values);
    } else {
      await addSubcategory(values);
    }
    closeSubcategoryForm();
    await loadManagementData();
  }

  async function handleArchiveSubcategory(subcategory: Subcategory) {
    await archiveSubcategory(subcategory.id);
    await loadManagementData();
  }

  async function handleRestoreSubcategory(subcategory: Subcategory) {
    await restoreSubcategory(subcategory.id);
    await loadManagementData();
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Akses langganan</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Sistem Tier DANAPETA</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            BASIC gratis dapat diklaim lewat website. Setelah lisensi BASIC aktif, pengguna mendapat 1 akun aktif. PRO dan ELITE membuka akun tanpa batas serta fitur perencanaan lanjutan.
          </p>
        </div>
        <div className="rounded-lg bg-surface px-4 py-3 shadow-soft">
          <p className="text-xs font-semibold text-secondary">Tier aktif</p>
          <p className="text-lg font-bold text-ink">{tierDefinitions[tier].name}</p>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-3 sm:gap-4">
        {(["basic", "pro", "elite"] as CommercialTier[]).map((item) => {
          const definition = tierDefinitions[item];
          const isActive = item === tier;
          const accountLimit = getTierLimit(item, "account_count");
          return (
            <Card key={item} className={isActive ? "border border-sage/40" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-sage">{definition.name}</p>
                  <h3 className="mt-2 text-lg font-bold text-ink">{definition.tagline}</h3>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-lg ${isActive ? "bg-mint/30" : "bg-muted"} text-ink`}>
                  {isActive ? <BadgeCheck size={19} aria-hidden="true" /> : <Lock size={19} aria-hidden="true" />}
                </span>
              </div>
              <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-secondary">
                {Number.isFinite(accountLimit) ? `${accountLimit} akun aktif` : "Akun tanpa batas"}
              </p>
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-secondary">
                {isActive ? "Aktif di perangkat ini" : item === "basic" ? "Gratis via lisensi dari website" : `Butuh lisensi ${definition.name}`}
              </p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card title="Aktivasi Lisensi" eyebrow="Akses aplikasi">
          <form className="grid gap-3" onSubmit={handleLicenseSubmit}>
            <Field label="Kode lisensi">
              <Input
                value={licenseKey}
                placeholder="DANAPETA-ELITE-XXXX"
                autoCapitalize="characters"
                onChange={(event) => setLicenseKey(event.target.value)}
              />
            </Field>
            <FormActions>
              <Button type="submit" disabled={!licenseKey.trim()}>
                Aktifkan lisensi
              </Button>
              {licenseStatus && (
                <Button type="button" variant="secondary" onClick={() => void handleClearLicense()}>
                  Hapus lisensi
                </Button>
              )}
            </FormActions>
          </form>
          <p className="mt-4 text-sm leading-6 text-secondary">
            Satu lisensi berlaku untuk satu perangkat aktif. Untuk pindah perangkat, backup data lebih dulu, hapus lisensi di perangkat lama, lalu aktivasi dan restore di perangkat baru.
          </p>
        </Card>

        <Card title="Status Lisensi" eyebrow="Perangkat ini">
          {licenseStatus ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg bg-mint/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">Aktif</p>
                <p className="mt-1 text-lg font-bold text-ink">{tierDefinitions[licenseStatus.tier].name}</p>
              </div>
              <p className="text-secondary">Key: <span className="font-semibold text-ink">{licenseStatus.licenseKeyPreview}</span></p>
              <p className="text-secondary">Perangkat: <span className="font-semibold text-ink">{licenseStatus.deviceLabel}</span></p>
              <p className="text-secondary">Limit: <span className="font-semibold text-ink">{licenseStatus.deviceLimit} perangkat aktif</span></p>
              <p className="text-secondary">Aktivasi: <span className="font-semibold text-ink">{new Date(licenseStatus.activatedAt).toLocaleString("id-ID")}</span></p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-4 text-sm leading-6 text-secondary">
              Belum ada lisensi aktif. Klaim lisensi BASIC gratis lewat website untuk mulai memakai pencatatan finansial real.
            </div>
          )}
        </Card>
      </section>

      {(statusMessage || errorMessage) && (
        <section>
          {errorMessage ? (
            <ErrorState body={errorMessage} onRetry={() => setErrorMessage("")} />
          ) : (
            <div className="rounded-lg bg-mint/25 p-4 text-sm font-semibold text-ink" role="status" aria-live="polite">
              {statusMessage}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card title="Backup, Restore, dan PDF" eyebrow="Portabilitas data">
          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" icon={<Download size={17} aria-hidden="true" />} onClick={() => void handleBackupDownload()}>
              Backup
            </Button>
            <Button variant="secondary" icon={<Upload size={17} aria-hidden="true" />} onClick={() => backupInputRef.current?.click()}>
              Restore
            </Button>
            <Button variant="secondary" icon={<FileText size={17} aria-hidden="true" />} disabled={!canExportPdfReport} onClick={() => void handlePdfExport()}>
              Laporan PDF
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" icon={<ShieldCheck size={17} aria-hidden="true" />} onClick={() => setEncryptedBackupOpen(true)}>
              Backup terenkripsi
            </Button>
            <Button variant="secondary" icon={<Upload size={17} aria-hidden="true" />} onClick={() => encryptedBackupInputRef.current?.click()}>
              Restore terenkripsi
            </Button>
          </div>
          {!canExportPdfReport && (
            <div className="mt-3">
              <LockedFeature feature="premium_reports" compact />
            </div>
          )}
          <div className="mt-3">
            <HelpModalButton topic="report" label="Dasar laporan" />
          </div>
          <p className="mt-4 text-sm leading-6 text-secondary">
            Backup mencakup semua tabel lokal. Restore akan mengganti workspace lokal di perangkat ini, jadi unduh backup terbaru lebih dulu jika membutuhkan titik pemulihan.
          </p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Backup terenkripsi dibuat di perangkat Anda. Simpan file .danapeta ke Google Drive pribadi; DANAPETA tidak menerima atau membaca isi file tersebut.
          </p>
          <input
            ref={backupInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleRestore(file);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={encryptedBackupInputRef}
            className="hidden"
            type="file"
            accept=".danapeta,application/json,application/vnd.danapeta.backup+json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setEncryptedRestoreFile(file);
                setEncryptedRestoreOpen(true);
              }
              event.currentTarget.value = "";
            }}
          />
        </Card>
        <Card title="Pengalaman Aplikasi" eyebrow="Setup dan panduan">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant={theme === "light" ? "primary" : "secondary"}
                onClick={() => void handleTheme("light")}
                aria-pressed={theme === "light"}
              >
                Tema terang
              </Button>
              <Button
                variant={theme === "warm" ? "primary" : "secondary"}
                onClick={() => void handleTheme("warm")}
                aria-pressed={theme === "warm"}
              >
                Tema hangat
              </Button>
            </div>
            <Button variant="secondary" icon={<Smartphone size={17} aria-hidden="true" />} onClick={() => void installApp()}>
              {installPromptAvailable ? "Pasang aplikasi" : "Panduan instalasi"}
            </Button>
            <Button variant="secondary" icon={<RotateCcw size={17} aria-hidden="true" />} onClick={() => void resetOnboarding()}>
              Ulang tutorial
            </Button>
            <Button variant="secondary" className="text-danger" icon={<Trash2 size={17} aria-hidden="true" />} onClick={() => setResetDataOpen(true)}>
              Reset data finansial
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-secondary">
            Instalasi bergantung pada kelayakan PWA di browser. Tutorial dapat diulang kapan saja tanpa mengubah data finansial lokal.
          </p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Reset data finansial menghapus akun, transaksi, budget, goals, aset, liabilitas, aturan rutin, insight, dan riwayat import. Lisensi perangkat tidak ikut dihapus.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card
          title="Kategori"
          eyebrow="Taksonomi utama"
          action={
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
                <input className="h-4 w-4 accent-sage" type="checkbox" checked={showArchivedCategories} onChange={(event) => setShowArchivedCategories(event.target.checked)} />
                Arsip
              </label>
              <Button className="h-9 px-3" icon={<Plus size={16} aria-hidden="true" />} onClick={() => openCategoryForm()}>
                Tambah
              </Button>
              <Button variant="secondary" className="h-9 px-3" onClick={() => void handleApplyCategoryTemplate()}>
                Template standar
              </Button>
            </div>
          }
        >
          <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div key={category.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-muted/70 px-3">
                <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => openCategoryForm(category)}>
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{category.name}</span>
                    <span className="text-xs capitalize text-secondary">{category.kind} - {category.icon}{category.isArchived ? " - archived" : ""}</span>
                  </span>
                </button>
                {category.isArchived ? (
                  <Button variant="ghost" className="h-9 px-2" onClick={() => void handleRestoreCategory(category)}>
                    Pulihkan
                  </Button>
                ) : (
                  <Button variant="ghost" className="h-9 px-2 text-danger" onClick={() => void handleArchiveCategory(category)}>
                    Arsipkan
                  </Button>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="rounded-lg bg-muted p-4 text-sm text-secondary">Belum ada kategori.</p>}
          </div>
        </Card>

        <Card
          title="Subkategori"
          eyebrow="Detail kategori"
          action={
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
                <input className="h-4 w-4 accent-sage" type="checkbox" checked={showArchivedSubcategories} onChange={(event) => setShowArchivedSubcategories(event.target.checked)} />
                Arsip
              </label>
              <Button className="h-9 px-3" icon={<Plus size={16} aria-hidden="true" />} onClick={() => openSubcategoryForm()}>
                Tambah
              </Button>
            </div>
          }
        >
          <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
            {subcategories.map((subcategory) => {
              const category = categories.find((item) => item.id === subcategory.categoryId);
              return (
                <div key={subcategory.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-muted/70 px-3">
                  <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => openSubcategoryForm(subcategory)}>
                    <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: subcategory.color ?? category?.color ?? "#7FAE93" }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{subcategory.name}</span>
                      <span className="text-xs text-secondary">
                        {category?.name ?? "Category"}{subcategory.icon ? ` - ${subcategory.icon}` : ""}{subcategory.isArchived ? " - archived" : ""}
                      </span>
                    </span>
                  </button>
                  {subcategory.isArchived ? (
                  <Button variant="ghost" className="h-9 px-2" onClick={() => void handleRestoreSubcategory(subcategory)}>
                    Pulihkan
                    </Button>
                  ) : (
                  <Button variant="ghost" className="h-9 px-2 text-danger" onClick={() => void handleArchiveSubcategory(subcategory)}>
                    Arsipkan
                    </Button>
                  )}
                </div>
              );
            })}
            {subcategories.length === 0 && <p className="rounded-lg bg-muted p-4 text-sm text-secondary">Belum ada subkategori.</p>}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card title="Matriks Akses Fitur" eyebrow="Peta kapabilitas">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-secondary">
                  <th className="px-3 py-2 font-semibold">Fitur</th>
                  <th className="px-3 py-2 font-semibold">BASIC</th>
                  <th className="px-3 py-2 font-semibold">PRO</th>
                  <th className="px-3 py-2 font-semibold">ELITE</th>
                </tr>
              </thead>
              <tbody>
                {commercialFeatures.map((feature) => (
                  <tr key={feature} className="bg-muted/70">
                    <td className="rounded-l-lg px-3 py-3 font-semibold text-ink">{featureLabels[feature]}</td>
                    <FeatureCell tier="basic" feature={feature} />
                    <FeatureCell tier="pro" feature={feature} />
                    <FeatureCell tier="elite" feature={feature} last />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card title="Siap Lisensi" eyebrow="Dukungan berikutnya">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky/25 text-ink">
                <KeyRound size={19} aria-hidden="true" />
              </span>
              <p className="text-sm leading-6 text-secondary">
                Tier aktif sekarang berasal dari license key lokal dan dicatat untuk satu perangkat. Endpoint aktivasi berikutnya dapat memvalidasi device id ini di server.
              </p>
            </div>
          </Card>
          <Card title="Keamanan Data" eyebrow="Offline-first">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-mint/30 text-ink">
                <ShieldCheck size={19} aria-hidden="true" />
              </span>
              <p className="text-sm leading-6 text-secondary">
                Perubahan tier tidak menghapus data lokal. Aksi premium yang terkunci dihentikan, sementara data yang sudah ada tetap dapat dibaca.
              </p>
            </div>
          </Card>
        </div>
      </section>

      <Modal open={isCategoryFormOpen} title={activeCategory ? "Edit kategori" : "Tambah kategori"} onClose={closeCategoryForm}>
        <CategoryForm category={activeCategory} onSubmit={handleCategorySubmit} onCancel={closeCategoryForm} />
      </Modal>

      <Modal open={isSubcategoryFormOpen} title={activeSubcategory ? "Edit subkategori" : "Tambah subkategori"} onClose={closeSubcategoryForm}>
        <SubcategoryForm
          categories={categories.filter((category) => !category.isArchived || category.id === activeSubcategory?.categoryId)}
          subcategory={activeSubcategory}
          onSubmit={handleSubcategorySubmit}
          onCancel={closeSubcategoryForm}
        />
      </Modal>

      <Modal open={isEncryptedBackupOpen} title="Backup terenkripsi" onClose={() => setEncryptedBackupOpen(false)}>
        <form className="grid gap-4" onSubmit={handleEncryptedBackupSubmit}>
          <p className="text-sm leading-6 text-secondary">
            Buat passphrase yang kuat. File backup akan terenkripsi di perangkat ini dan bisa disimpan ke Google Drive pribadi.
          </p>
          <Field label="Passphrase backup">
            <Input
              type="password"
              minLength={8}
              required
              value={encryptedBackupPassphrase}
              placeholder="Minimal 8 karakter"
              onChange={(event) => setEncryptedBackupPassphrase(event.target.value)}
            />
          </Field>
          <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-secondary">
            Jika passphrase hilang, file backup terenkripsi tidak bisa dibuka kembali oleh DANAPETA.
          </p>
          <FormActions>
            <Button variant="secondary" onClick={() => setEncryptedBackupOpen(false)}>
              Batal
            </Button>
            <Button type="submit">Unduh backup terenkripsi</Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={isEncryptedRestoreOpen} title="Restore backup terenkripsi" onClose={() => setEncryptedRestoreOpen(false)}>
        <form className="grid gap-4" onSubmit={handleEncryptedRestoreSubmit}>
          <p className="text-sm leading-6 text-secondary">
            Pilih file .danapeta dari penyimpanan pribadi Anda, lalu masukkan passphrase yang sama dengan saat backup dibuat.
          </p>
          <div className="rounded-lg bg-muted p-3 text-sm font-semibold text-ink">
            {encryptedRestoreFile?.name ?? "Belum ada file dipilih"}
          </div>
          <Field label="Passphrase backup">
            <Input
              type="password"
              minLength={8}
              required
              value={encryptedRestorePassphrase}
              placeholder="Passphrase backup"
              onChange={(event) => setEncryptedRestorePassphrase(event.target.value)}
            />
          </Field>
          <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-secondary">
            Restore mengganti data lokal finansial, tetapi lisensi aktif perangkat ini tidak ikut ditimpa oleh file backup.
          </p>
          <FormActions>
            <Button variant="secondary" onClick={() => setEncryptedRestoreOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!encryptedRestoreFile}>Restore terenkripsi</Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={isResetDataOpen} title="Reset data finansial" onClose={() => setResetDataOpen(false)}>
        <div className="grid gap-4">
          <div className="rounded-lg bg-danger/10 p-3 text-sm leading-6 text-secondary">
            Aksi ini menghapus data finansial lokal di perangkat ini: akun, transaksi, budget, goals, aset, liabilitas, transaksi rutin, insight, dan import history. Lisensi dan identitas perangkat tetap dipertahankan.
          </div>
          <label className="flex items-start gap-3 rounded-lg bg-muted p-3 text-sm leading-6 text-secondary">
            <input
              className="mt-1 h-4 w-4 accent-sage"
              type="checkbox"
              checked={resetBackupAcknowledged}
              onChange={(event) => setResetBackupAcknowledged(event.target.checked)}
            />
            <span>Saya paham data finansial akan dihapus dari perangkat ini. Saya sudah membuat backup jika masih membutuhkan data lama.</span>
          </label>
          <Field label='Ketik "RESET DANAPETA" untuk konfirmasi'>
            <Input value={resetConfirmText} onChange={(event) => setResetConfirmText(event.target.value)} />
          </Field>
          <FormActions>
            <Button variant="secondary" onClick={() => setResetDataOpen(false)}>
              Batal
            </Button>
            <Button className="bg-danger text-white hover:bg-danger" disabled={!resetBackupAcknowledged || resetConfirmText !== "RESET DANAPETA"} onClick={() => void handleResetData()}>
              Reset data
            </Button>
          </FormActions>
        </div>
      </Modal>
    </>
  );
}

function FeatureCell({ tier, feature, last = false }: { tier: CommercialTier; feature: FeatureKey; last?: boolean }) {
  const enabled = tierDefinitions[tier].features.includes(feature);
  return (
    <td className={`px-3 py-3 ${last ? "rounded-r-lg" : ""}`}>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${enabled ? "bg-mint/30 text-ink" : "bg-surface text-secondary"}`}>
        {enabled ? "Termasuk" : "Terkunci"}
      </span>
    </td>
  );
}

type CategoryFormValues = {
  name: string;
  kind: Category["kind"];
  color: string;
  icon: string;
};

function CategoryForm({
  category,
  onSubmit,
  onCancel
}: {
  category?: Category;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<Category["kind"]>(category?.kind ?? "expense");
  const [color, setColor] = useState(category?.color ?? "#7FAE93");
  const [icon, setIcon] = useState(category?.icon ?? "circle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      kind,
      color,
      icon: icon.trim() || "circle"
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Category name">
        <Input required value={name} placeholder="Rumah Tangga, Transportasi" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <Select disabled={Boolean(category)} value={kind} onChange={(event) => setKind(event.target.value as Category["kind"])}>
            <option value="expense">Expense (pengeluaran)</option>
            <option value="income">Income (pemasukan)</option>
            <option value="transfer">Transfer</option>
          </Select>
        </Field>
        <Field label="Color">
          <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>
      </div>
      <Field label="Icon">
        <Input value={icon} placeholder="home, car, circle" onChange={(event) => setIcon(event.target.value)} />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Save category
        </Button>
      </FormActions>
    </form>
  );
}

type SubcategoryFormValues = {
  categoryId: string;
  name: string;
  color?: string;
  icon?: string;
};

function SubcategoryForm({
  categories,
  subcategory,
  onSubmit,
  onCancel
}: {
  categories: Category[];
  subcategory?: Subcategory;
  onSubmit: (values: SubcategoryFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(subcategory?.categoryId ?? categories[0]?.id ?? "");
  const [name, setName] = useState(subcategory?.name ?? "");
  const [color, setColor] = useState(subcategory?.color ?? "");
  const [icon, setIcon] = useState(subcategory?.icon ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      categoryId,
      name: name.trim(),
      color: color || undefined,
      icon: icon.trim() || undefined
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Parent category">
        <Select required disabled={Boolean(subcategory)} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Subcategory name">
        <Input required value={name} placeholder="Belanja Bulanan, Internet, Gaji" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Color" hint="Optional. Empty uses category color.">
          <Input type="color" value={color || "#88B99A"} onChange={(event) => setColor(event.target.value)} />
        </Field>
        <Field label="Icon">
          <Input value={icon} placeholder="optional" onChange={(event) => setIcon(event.target.value)} />
        </Field>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!categoryId || !name.trim()}>
          Save subcategory
        </Button>
      </FormActions>
    </form>
  );
}
