import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output';
import {
  fileExists,
  inTemporaryDirectory,
  readFile,
  writeFile,
} from '@shopify/cli-kit/node/fs';
import {joinPath} from '@shopify/cli-kit/node/path';
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui';

import {type AdminSession, login} from '../../../lib/auth.js';
import {getStorefrontEnvironments} from '../../../lib/graphql/admin/list-environments.js';
import {getStorefrontEnvVariables} from '../../../lib/graphql/admin/pull-variables.js';
import {dummyListEnvironments} from '../../../lib/graphql/admin/test-helper.js';

import {runEnvPull} from './pull.js';
import {renderMissingStorefront} from '../../../lib/render-errors.js';
import {verifyLinkedStorefront} from '../../../lib/verify-linked-storefront.js';

vi.mock('@shopify/cli-kit/node/ui', async () => {
  const original = await vi.importActual<
    typeof import('@shopify/cli-kit/node/ui')
  >('@shopify/cli-kit/node/ui');
  return {
    ...original,
    renderConfirmationPrompt: vi.fn(),
  };
});
vi.mock('../link.js');
vi.mock('../../../lib/auth.js');
vi.mock('../../../lib/render-errors.js');
vi.mock('../../../lib/graphql/admin/list-environments.js');
vi.mock('../../../lib/verify-linked-storefront.js');
vi.mock('../../../lib/graphql/admin/pull-variables.js');

describe('pullVariables', () => {
  const ADMIN_SESSION: AdminSession = {
    token: 'abc123',
    storeFqdn: 'my-shop',
  };

  const SHOPIFY_CONFIG = {
    shop: 'my-shop',
    shopName: 'My Shop',
    email: 'email',
    storefront: {
      id: 'gid://shopify/HydrogenStorefront/2',
      title: 'Existing Link',
    },
  };

  beforeEach(async () => {
    vi.mocked(login).mockResolvedValue({
      session: ADMIN_SESSION,
      config: SHOPIFY_CONFIG,
    });

    vi.mocked(getStorefrontEnvironments).mockResolvedValue(
      dummyListEnvironments(SHOPIFY_CONFIG.storefront.id),
    );

    vi.mocked(verifyLinkedStorefront).mockResolvedValue({
      id: SHOPIFY_CONFIG.storefront.id,
      title: SHOPIFY_CONFIG.storefront.title,
      productionUrl: 'https://my-shop.myshopify.com',
    });

    vi.mocked(getStorefrontEnvVariables).mockResolvedValue({
      id: SHOPIFY_CONFIG.storefront.id,
      environmentVariables: [
        {
          id: 'gid://shopify/HydrogenStorefrontEnvironmentVariable/1',
          key: 'PUBLIC_API_TOKEN',
          value: 'abc123',
          readOnly: true,
          isSecret: false,
        },
        {
          id: 'gid://shopify/HydrogenStorefrontEnvironmentVariable/2',
          key: 'PRIVATE_API_TOKEN',
          value: '',
          readOnly: true,
          isSecret: true,
        },
      ],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    mockAndCaptureOutput().clear();
  });

  describe('when environment is provided', () => {
    it('calls getStorefrontEnvVariables when handle is provided', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await runEnvPull({path: tmpDir, env: 'staging'});

        expect(getStorefrontEnvVariables).toHaveBeenCalledWith(
          ADMIN_SESSION,
          SHOPIFY_CONFIG.storefront.id,
          'staging',
        );
      });
    });

    it('calls getStorefrontEnvVariables when branch is provided', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await runEnvPull({path: tmpDir, envBranch: 'main'});

        expect(getStorefrontEnvVariables).toHaveBeenCalledWith(
          ADMIN_SESSION,
          SHOPIFY_CONFIG.storefront.id,
          'production',
        );
      });
    });

    it('throws error if handle does not map to any environment', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await expect(
          runEnvPull({path: tmpDir, env: 'fake'}),
        ).rejects.toThrowError('Environment not found');
      });
    });

    it('throws error if branch does not map to any environment', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await expect(
          runEnvPull({path: tmpDir, envBranch: 'fake'}),
        ).rejects.toThrowError('Environment not found');
      });
    });
  });

  it('writes environment variables to a .env file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, '.env');

      expect(await fileExists(filePath)).toBeFalsy();

      await runEnvPull({path: tmpDir});

      expect(await readFile(filePath)).toStrictEqual(
        'PUBLIC_API_TOKEN=abc123\n' + 'PRIVATE_API_TOKEN=""',
      );
    });
  });

  it('warns about secret environment variables', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputMock = mockAndCaptureOutput();

      await runEnvPull({path: tmpDir});

      expect(outputMock.warn()).toMatch(
        /Existing Link contains environment variables marked as secret, so their/,
      );
      expect(outputMock.warn()).toMatch(/values weren’t pulled./);
    });
  });

  it('renders a success message', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputMock = mockAndCaptureOutput();

      await runEnvPull({path: tmpDir});

      expect(outputMock.info()).toMatch(
        /Changes have been made to your \.env file/,
      );
    });
  });

  describe('when environment variables are empty', () => {
    beforeEach(() => {
      vi.mocked(getStorefrontEnvVariables).mockResolvedValue({
        id: 'gid://shopify/HydrogenStorefront/1',
        environmentVariables: [],
      });
    });

    it('renders a message', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const outputMock = mockAndCaptureOutput();

        await runEnvPull({path: tmpDir});

        expect(outputMock.info()).toMatch(/No environment variables found\./);
      });
    });
  });

  describe('when there is no linked storefront', () => {
    beforeEach(async () => {
      vi.mocked(verifyLinkedStorefront).mockResolvedValue(undefined);
    });

    it('ends without requesting variables', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await runEnvPull({path: tmpDir});

        expect(getStorefrontEnvVariables).not.toHaveBeenCalled();
      });
    });

    describe('and the user does not create a new link', () => {
      it('ends without requesting variables', async () => {
        vi.mocked(renderConfirmationPrompt).mockResolvedValue(false);

        await inTemporaryDirectory(async (tmpDir) => {
          await runEnvPull({path: tmpDir});

          expect(getStorefrontEnvVariables).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('when there is no matching storefront in the shop', () => {
    beforeEach(() => {
      vi.mocked(getStorefrontEnvVariables).mockResolvedValue(null);
    });

    it('renders missing storefronts message and ends', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await runEnvPull({path: tmpDir});

        expect(renderMissingStorefront).toHaveBeenCalledOnce();
      });
    });
  });

  describe('when a .env file already exists', () => {
    beforeEach(() => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true);
    });

    it('prompts the user to confirm', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const filePath = joinPath(tmpDir, '.env');
        await writeFile(filePath, 'EXISTING_TOKEN=1');

        await runEnvPull({path: tmpDir});

        expect(renderConfirmationPrompt).toHaveBeenCalledWith({
          confirmationMessage: `Yes, confirm changes`,
          cancellationMessage: `No, make changes later`,
          message: expect.stringMatching(
            /We'll make the following changes to your \.env file:/,
          ),
        });
      });
    });

    describe('and --force is enabled', () => {
      it('does not prompt the user to confirm', async () => {
        await inTemporaryDirectory(async (tmpDir) => {
          const filePath = joinPath(tmpDir, '.env');
          await writeFile(filePath, 'EXISTING_TOKEN=1');

          await runEnvPull({path: tmpDir, force: true});

          expect(renderConfirmationPrompt).not.toHaveBeenCalled();
        });
      });
    });
  });
});
