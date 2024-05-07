import {
  basename,
  dirname,
  joinPath,
  resolvePath,
} from '@shopify/cli-kit/node/path';
import {findFileWithExtension} from './file.js';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);

// Do not import JS from here, only types
import type {HydrogenPlugin} from '~/hydrogen/vite/plugin.js';
import type {OxygenPlugin} from '~/mini-oxygen/vite/plugin.js';

export async function hasViteConfig(root: string) {
  const result = await findFileWithExtension(root, 'vite.config');
  return !!result.filepath;
}

export async function getViteConfig(root: string, ssrEntryFlag?: string) {
  const vitePath = require.resolve('vite', {paths: [root]});
  const viewNodePath = joinPath(vitePath, '..', 'dist', 'node', 'index.js');
  type Vite = typeof import('vite');
  const vite: Vite = await import(viewNodePath);

  const command = 'build';
  const mode = process.env.NODE_ENV || 'production';

  const maybeConfig = await vite.loadConfigFromFile(
    {command, mode, isSsrBuild: true},
    undefined,
    root,
  );

  if (!maybeConfig || !maybeConfig.path) {
    throw new Error('No Vite config found');
  }

  const resolvedViteConfig = await vite.resolveConfig(
    {root, build: {ssr: true}},
    command,
    mode,
    mode,
  );

  const {appDirectory, serverBuildFile, routes} =
    getRemixConfigFromVite(resolvedViteConfig);

  const serverOutDir = resolvedViteConfig.build.outDir;
  const clientOutDir = serverOutDir.replace(/server$/, 'client');

  const rollupOutput = resolvedViteConfig.build.rollupOptions.output;
  const {entryFileNames} =
    (Array.isArray(rollupOutput) ? rollupOutput[0] : rollupOutput) ?? {};

  const serverOutFile = joinPath(
    serverOutDir,
    typeof entryFileNames === 'string'
      ? entryFileNames
      : serverBuildFile ?? 'index.js',
  );

  const ssrEntry = ssrEntryFlag ?? resolvedViteConfig.build.ssr;
  const resolvedSsrEntry = resolvePath(
    resolvedViteConfig.root,
    typeof ssrEntry === 'string' ? ssrEntry : 'server',
  );

  return {
    clientOutDir,
    serverOutDir,
    serverOutFile,
    resolvedViteConfig,
    userViteConfig: maybeConfig.config,
    remixConfig: {
      routes: routes ?? {},
      appDirectory: appDirectory ?? joinPath(resolvedViteConfig.root, 'app'),
      rootDirectory: resolvedViteConfig.root,
      serverEntryPoint:
        (
          await findFileWithExtension(
            dirname(resolvedSsrEntry),
            basename(resolvedSsrEntry),
          )
        ).filepath || resolvedSsrEntry,
    },
  };
}

function getRemixConfigFromVite(viteConfig: any) {
  const {remixConfig} =
    findHydrogenPlugin(viteConfig)?.api?.getPluginOptions() ?? {};

  return remixConfig
    ? {
        appDirectory: remixConfig.appDirectory,
        serverBuildFile: remixConfig.serverBuildFile,
        routes: remixConfig.routes,
      }
    : {};
}

type MinimalViteConfig = {plugins: Readonly<Array<{name: string}>>};

function findPlugin<
  PluginType extends Config['plugins'][number],
  Config extends MinimalViteConfig = MinimalViteConfig,
>(config: Config, name: string) {
  return config.plugins.find((plugin) => plugin.name === name) as
    | PluginType
    | undefined;
}

export function findHydrogenPlugin<Config extends MinimalViteConfig>(
  config: Config,
) {
  return findPlugin<HydrogenPlugin>(config, 'hydrogen:main');
}
export function findOxygenPlugin<Config extends MinimalViteConfig>(
  config: Config,
) {
  return findPlugin<OxygenPlugin>(config, 'oxygen:main');
}
