/* eslint-disable no-console */
import { db } from '@/db/db';

export const runDexieMigration = async () => {
  try {
    // Check if Dexie has any transactions
    const count = await db.transactions.count();
    if (count > 0) {
      console.log('Dexie DB already populated. Skipping migration.');
      return;
    }

    // Try to read from localStorage
    const storageKey = 'spendwise-storage';
    const rawData = localStorage.getItem(storageKey);

    if (!rawData) {
      console.log('No local storage data found for migration.');
      return;
    }

    const parsed = JSON.parse(rawData);

    if (!parsed || !parsed.state) {
      return;
    }

    const { state } = parsed;

    console.log('Migrating data from localStorage to Dexie...');

    // We can use a transaction to ensure all or nothing
    await db.transaction(
      'rw',
      [db.transactions, db.config, db.goals, db.customCategories],
      async () => {
        if (state.transactions && Array.isArray(state.transactions)) {
          await db.transactions.bulkAdd(state.transactions);
        }

        if (state.config) {
          await db.config.put({ id: 'app-config', ...state.config });
        }

        if (state.goals && Array.isArray(state.goals)) {
          await db.goals.bulkAdd(state.goals);
        }

        if (state.customCategories && Array.isArray(state.customCategories)) {
          await db.customCategories.bulkAdd(state.customCategories);
        }
      }
    );

    console.log('Migration complete!');
  } catch (error) {
    console.error('Error migrating data to Dexie:', error);
  }
};
