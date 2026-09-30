export type CodexAccess = 'full' | 'ask' | 'auto';

export function codexPermissions(access: CodexAccess = 'full', mode: 'default' | 'plan', cwd: string) {
  // Planning and the read-only Jira roles keep their boundary regardless of the saved default.
  if (mode === 'plan') return {
    sandbox: 'read-only', approvalPolicy: 'never', approvalsReviewer: 'user',
    sandboxPolicy: { type: 'readOnly', networkAccess: false },
  };
  if (access === 'full') return {
    sandbox: 'danger-full-access', approvalPolicy: 'never', approvalsReviewer: 'user',
    sandboxPolicy: { type: 'dangerFullAccess' },
  };
  return {
    sandbox: 'workspace-write', approvalPolicy: 'on-request', approvalsReviewer: access === 'auto' ? 'auto_review' : 'user',
    sandboxPolicy: { type: 'workspaceWrite', writableRoots: [cwd], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
  };
}

export function verifyCodexPermissions(response: any, expected: ReturnType<typeof codexPermissions>) {
  // The native server enforces managed requirements. Never silently substitute another mode.
  if ((response.approvalPolicy !== undefined && response.approvalPolicy !== expected.approvalPolicy)
    || (response.approvalsReviewer !== undefined && response.approvalsReviewer !== expected.approvalsReviewer)
    || (response.sandbox !== undefined && response.sandbox?.type !== expected.sandboxPolicy.type)) {
    throw new Error('Codex could not apply the selected access mode. Check the Codex policy on your PC.');
  }
}
