import { invoke } from './payments';

export async function deleteAccount(): Promise<void> {
  await invoke<{ deleted: boolean }>('delete-account', {});
}
