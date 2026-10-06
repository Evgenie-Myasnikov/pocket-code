import { WindowsJiraStore, type JiraStore } from './jira-vault.js';
/** Reuse the host's Windows DPAPI storage; the encrypted file lives outside repositories. */
export class WindowsMiroStore implements JiraStore {
  private store: WindowsJiraStore;
  constructor(file: string) {
    this.store = new WindowsJiraStore(file);
  }
  async load() {
    try {
      return await this.store.load();
    } catch {
      throw Error('Miro credential vault unavailable.');
    }
  }
  async save(value: unknown) {
    try {
      await this.store.save(value);
    } catch {
      throw Error('Miro credential vault unavailable.');
    }
  }
}
