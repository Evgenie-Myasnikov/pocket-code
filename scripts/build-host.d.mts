export function buildHostBundle(root: string): Promise<{
  asset: string;
  bytes: Buffer;
  fileCount: number;
}>;
