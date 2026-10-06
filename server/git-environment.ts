/** Keep user tracing/auth preferences, but never inherit another repository or index from a Git hook. */
export function isolatedGitEnvironment(){
  const env={...process.env};
  for(const name of Object.keys(env))if(/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|PREFIX|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG(?:_.*)?|SHALLOW_FILE|REPLACE_REF_BASE|NAMESPACE)$/.test(name))delete env[name];
  return env;
}
