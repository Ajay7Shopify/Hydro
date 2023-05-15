import type {Types} from '@graphql-codegen/plugin-helpers';
import * as addPlugin from '@graphql-codegen/add';
import * as typescriptOperationPlugin from '@graphql-codegen/typescript-operations';
import {processSources} from './sources.js';
import {plugin as dtsPlugin} from './plugin.js';
import {getSchema} from './schema.js';

export type GqlTagConfig = {};

const interfaceExtensionCode = `
declare module '@shopify/hydrogen' {
  interface QueryTypes extends GeneratedQueryTypes {}
  interface MutationTypes extends GeneratedMutationTypes {}
}`;

export const preset: Types.OutputPreset<GqlTagConfig> = {
  buildGeneratesSection: (options) => {
    if (!options.baseOutputDir.endsWith('.d.ts')) {
      throw new Error('[hydrogen-preset] target output should be a .d.ts file');
    }

    if (
      options.plugins?.length > 0 &&
      Object.keys(options.plugins).some((p) => p.startsWith('typescript'))
    ) {
      throw new Error(
        '[hydrogen-preset] providing additional typescript-based `plugins` leads to duplicated generated types',
      );
    }

    const sourcesWithOperations = processSources(options.documents);
    const sources = sourcesWithOperations.map(({source}) => source);

    const pluginMap = {
      ...options.pluginMap,
      [`add`]: addPlugin,
      [`typescript-operations`]: typescriptOperationPlugin,
      [`gen-dts`]: {plugin: dtsPlugin},
    };

    const namespacedImportName = 'SFAPI';

    const plugins: Array<Types.ConfiguredPlugin> = [
      // 1. Disable eslint for the generated file
      {
        [`add`]: {
          content: `/* eslint-disable eslint-comments/disable-enable-pair */\n/* eslint-disable eslint-comments/no-unlimited-disable */\n/* eslint-disable */`,
        },
      },
      // 2. Import all the generated API types from hydrogen-react
      {
        [`add`]: {
          content: `import * as ${namespacedImportName} from '@shopify/hydrogen/storefront-api-types';\n`,
        },
      },
      // 3. Generate the operations (i.e. queries, mutations, and fragments types)
      {
        [`typescript-operations`]: {
          skipTypename: true, // Skip __typename fields
          useTypeImports: true, // Use `import type` instead of `import`
          preResolveTypes: false, // Use Pick<...> instead of primitives
        },
      },
      // 4.  Augment Hydrogen query/mutation interfaces with the generated operations
      {[`gen-dts`]: {sourcesWithOperations, interfaceExtensionCode}},
      // 5. Custom plugins from the user
      ...options.plugins,
    ];

    return [
      {
        filename: options.baseOutputDir,
        plugins,
        pluginMap,
        schema: options.schema || getSchema(),
        config: {
          ...options.config,
          // This is for the operations plugin
          namespacedImportName,
        },
        documents: sources,
        documentTransforms: options.documentTransforms,
      },
    ];
  },
};
