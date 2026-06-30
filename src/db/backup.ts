import { exportDB, importDB } from 'dexie-export-import';
import { db } from '@/db/db';
import { formatLocalYYYYMMDD } from '@/utils/date';

/**
 * Exports the entire Dexie database to a JSON Blob.
 */
export const exportDatabase = async (): Promise<Blob> => {
  try {
    const blob = await exportDB(db, { prettyJson: true });
    return blob;
  } catch (error) {
    console.error('Failed to export database:', error);
    throw error;
  }
};

/**
 * Downloads the exported database as a JSON file.
 */
export const downloadDatabaseBackup = async () => {
  try {
    const blob = await exportDatabase();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendwise_backup_${formatLocalYYYYMMDD(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download backup:', error);
    throw error;
  }
};

/**
 * Imports a JSON file into the Dexie database, overwriting existing data.
 */
export const importDatabase = async (file: File) => {
  try {
    // Overwrite existing data
    await db.delete(); // Delete current DB
    await db.open(); // Re-open fresh DB
    await importDB(file);

    // After importing Dexie tables, we need to refresh the Zustand store
    // Since Zustand's persist reads from db.keyval on init, we can force a reload
    window.location.reload();
  } catch (error) {
    console.error('Failed to import database:', error);
    throw error;
  }
};
